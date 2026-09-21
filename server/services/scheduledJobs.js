const cron = require('node-cron');
const { runDailyDigest, runWeeklyDigest } = require('./digestScheduler');
const { tick: escalationTick } = require('./escalationResolver');
const { purgeExpiredRetention } = require('./deletionService');
const { processDueAssignmentJobs } = require('./assignmentSchedulingService');
const { tickHelpdeskSlaNotifications } = require('./helpdeskSlaMonitorService');
const { tickSlaPolicyInstances } = require('./sla/slaPolicyMonitorService');
const { isGmailIntegrationEnabled } = require('../config/emailFeatureFlags');
const { tickScheduledGmailInboxSync } = require('./gmailInboxSyncSchedulerService');
const { tickSnoozeWakeNotifications } = require('./snoozeWakeNotificationSchedulerService');
const { tickAppointmentReminders } = require('./appointmentReminderSchedulerService');
const { processDueDeferredAutomationActions } = require('./deferredAutomationSchedulerService');
const { tickBusinessHoursKpiAggregation } = require('./businessHoursKpiSchedulerService');
const { tickProcessWaitResume } = require('./processWaitResumeSchedulerService');
const { tickProcessSchedules } = require('./processScheduleSchedulerService');
const { tickQuoteExpiry } = require('./quoteExpirySchedulerService');
const { tickDocumentExpiryNotifications } = require('./documentExpiryNotificationSchedulerService');
const { tickDocumentExternalLinkChecks } = require('./documentExternalLinkSchedulerService');
const { tickDocumentOcrIndex } = require('./documentOcrIndexSchedulerService');
const { tickDocumentReservationExpiration } = require('./documentReservationExpirationSchedulerService');
const { processDuePlaybookDelayJobs } = require('./playbookSchedulingService');
const { processDuePlaybookAlertJobs } = require('./playbookAlertSchedulingService');
const { tickMarketingSegmentRefresh } = require('./marketing/marketingSegmentRefreshScheduler');
const { tickMarketingCampaignSchedule } = require('./marketing/marketingCampaignScheduleScheduler');
const { tickMarketingAbTests } = require('./marketing/marketingAbTestScheduler');
const { tickAmdsPolicySyncRetry } = require('./amds/amdsPolicySyncScheduler');

const NOTIFICATION_DEBUG = process.env.NOTIFICATION_DEBUG === 'true';
const ENABLE_DIGEST_SCHEDULER = process.env.ENABLE_DIGEST_SCHEDULER !== 'false'; // Default: enabled
const ENABLE_ESCALATION_SCHEDULER = process.env.ENABLE_ESCALATION_SCHEDULER !== 'false'; // Default: enabled (Phase 3)
const ENABLE_TRASH_RETENTION_SCHEDULER = process.env.ENABLE_TRASH_RETENTION_SCHEDULER !== 'false'; // Default: enabled
const ENABLE_ASSIGNMENT_SCHEDULER = process.env.ENABLE_ASSIGNMENT_SCHEDULER !== 'false'; // Default: enabled (Helpdesk Step 7C)
const ENABLE_HELPDESK_SLA_SCHEDULER = process.env.ENABLE_HELPDESK_SLA_SCHEDULER !== 'false'; // Default: enabled (Step 9)
const ENABLE_SLA_POLICY_SCHEDULER = process.env.ENABLE_SLA_POLICY_SCHEDULER !== 'false';
const ENABLE_GMAIL_INBOX_SYNC_SCHEDULER =
  isGmailIntegrationEnabled() && process.env.ENABLE_GMAIL_INBOX_SYNC_SCHEDULER !== 'false';
const ENABLE_SNOOZE_WAKE_NOTIFICATION_SCHEDULER =
  process.env.ENABLE_SNOOZE_WAKE_NOTIFICATION_SCHEDULER !== 'false'; // Default: enabled (Phase 6)
const ENABLE_APPOINTMENT_REMINDER_SCHEDULER =
  process.env.ENABLE_APPOINTMENT_REMINDER_SCHEDULER !== 'false'; // Default: enabled
const ENABLE_DEFERRED_AUTOMATION_SCHEDULER =
  process.env.ENABLE_DEFERRED_AUTOMATION_SCHEDULER !== 'false';
const ENABLE_BUSINESS_HOURS_KPI_SCHEDULER =
  process.env.ENABLE_BUSINESS_HOURS_KPI_SCHEDULER !== 'false';
const ENABLE_PROCESS_WAIT_RESUME_SCHEDULER =
  process.env.ENABLE_PROCESS_WAIT_RESUME_SCHEDULER !== 'false';
const ENABLE_PROCESS_SCHEDULE_SCHEDULER =
  process.env.ENABLE_PROCESS_SCHEDULE_SCHEDULER !== 'false';
const ENABLE_TARGET_RECALC_SCHEDULER =
  process.env.ENABLE_TARGET_RECALC_SCHEDULER !== 'false';
const ENABLE_QUOTE_EXPIRY_SCHEDULER =
  process.env.ENABLE_QUOTE_EXPIRY_SCHEDULER !== 'false';
const ENABLE_DOCUMENT_EXPIRY_NOTIFICATION_SCHEDULER =
  process.env.ENABLE_DOCUMENT_EXPIRY_NOTIFICATION_SCHEDULER !== 'false';
const ENABLE_DOCUMENT_EXTERNAL_LINK_SCHEDULER =
  process.env.ENABLE_DOCUMENT_EXTERNAL_LINK_SCHEDULER !== 'false';
const ENABLE_DOCUMENT_OCR_INDEX_SCHEDULER =
  process.env.ENABLE_DOCUMENT_OCR_INDEX_SCHEDULER !== 'false';
const ENABLE_DOCUMENT_RESERVATION_SCHEDULER =
  process.env.ENABLE_DOCUMENT_RESERVATION_SCHEDULER !== 'false';
const ENABLE_PLAYBOOK_DELAY_SCHEDULER =
  process.env.ENABLE_PLAYBOOK_DELAY_SCHEDULER !== 'false';
const ENABLE_PLAYBOOK_ALERT_SCHEDULER =
  process.env.ENABLE_PLAYBOOK_ALERT_SCHEDULER !== 'false';
const ENABLE_STALLED_INVITE_SCHEDULER =
  process.env.ENABLE_STALLED_INVITE_SCHEDULER !== 'false';
const ENABLE_TRIAL_NUDGE_SCHEDULER =
  process.env.ENABLE_TRIAL_NUDGE_SCHEDULER !== 'false';
const ENABLE_ADDON_TRIAL_EXPIRY_SCHEDULER =
  process.env.ENABLE_ADDON_TRIAL_EXPIRY_SCHEDULER !== 'false';
const ENABLE_COMMERCIAL_BILLING_PERIOD_SCHEDULER =
  process.env.ENABLE_COMMERCIAL_BILLING_PERIOD_SCHEDULER !== 'false';
const ENABLE_RELEASE_NOTE_PUBLISH_SCHEDULER =
  process.env.ENABLE_RELEASE_NOTE_PUBLISH_SCHEDULER !== 'false';
const ENABLE_ANNOUNCEMENT_LIFECYCLE_SCHEDULER =
  process.env.ENABLE_ANNOUNCEMENT_LIFECYCLE_SCHEDULER !== 'false';
const ENABLE_INTERNAL_CHAT_RETENTION_SCHEDULER =
  process.env.ENABLE_INTERNAL_CHAT_RETENTION_SCHEDULER !== 'false';
const ENABLE_SYSTEM_ANNOUNCEMENT_SCHEDULER =
  process.env.ENABLE_SYSTEM_ANNOUNCEMENT_SCHEDULER !== 'false';
const ENABLE_MARKETING_SEGMENT_REFRESH_SCHEDULER =
  process.env.ENABLE_MARKETING_SEGMENT_REFRESH_SCHEDULER !== 'false';
const ENABLE_MARKETING_CAMPAIGN_SCHEDULE_SCHEDULER =
  process.env.ENABLE_MARKETING_CAMPAIGN_SCHEDULE_SCHEDULER !== 'false';
const ENABLE_MARKETING_AB_TEST_SCHEDULER =
  process.env.ENABLE_MARKETING_AB_TEST_SCHEDULER !== 'false';
const ENABLE_AMDS_POLICY_SYNC_SCHEDULER =
  process.env.ENABLE_AMDS_POLICY_SYNC_SCHEDULER !== 'false';
/** Legacy Astra Autopilot / Super Agent schedulers removed with legacy AI (Astra v2). */
const ENABLE_ASTRA_AUTOPILOT_SCHEDULER = false;
const ENABLE_ASTRA_SUPER_AGENT_SCHEDULER = false;

let dailyDigestJob = null;
let weeklyDigestJob = null;
let escalationJob = null;
let trashRetentionJob = null;
let assignmentJob = null;
let helpdeskSlaJob = null;
let slaPolicyJob = null;
let gmailInboxSyncJob = null;
let snoozeWakeNotificationJob = null;
let appointmentReminderJob = null;
let deferredAutomationJob = null;
let businessHoursKpiJob = null;
let processWaitResumeJob = null;
let processScheduleJob = null;
let targetRecalcJob = null;
let quoteExpiryJob = null;
let documentExpiryNotificationJob = null;
let documentExternalLinkJob = null;
let documentOcrIndexJob = null;
let documentReservationJob = null;
let playbookDelayJob = null;
let playbookAlertJob = null;
let stalledInviteJob = null;
let trialNudgeJob = null;
let addonTrialExpiryJob = null;
let commercialBillingPeriodJob = null;
let releaseNotePublishJob = null;
let announcementLifecycleJob = null;
let internalChatRetentionJob = null;
let systemAnnouncementJob = null;
let marketingSegmentRefreshJob = null;
let marketingCampaignScheduleJob = null;
let marketingAbTestJob = null;
let amdsPolicySyncJob = null;

/**
 * Initialize and start scheduled jobs (node-cron).
 *
 * Master switch on the API process: set ENABLE_SCHEDULED_JOBS=false to skip
 * starting this module entirely (see server.js).
 *
 * Per-job toggles include ENABLE_DIGEST_SCHEDULER, ENABLE_ESCALATION_SCHEDULER,
 * ENABLE_GMAIL_INBOX_SYNC_SCHEDULER, etc.
 */
function startScheduledJobs() {
  console.log('[scheduledJobs] Starting scheduled jobs...');

  if (ENABLE_DIGEST_SCHEDULER) {

  // Daily digest: Every day at 9:00 AM
  // Cron format: minute hour day month day-of-week
  // '0 9 * * *' = 9:00 AM every day
  dailyDigestJob = cron.schedule('0 9 * * *', async () => {
    const startTime = new Date();
    console.log(`[scheduledJobs] Running daily digest at ${startTime.toISOString()}`);
    
    try {
      await runDailyDigest();
      const duration = Date.now() - startTime.getTime();
      console.log(`[scheduledJobs] Daily digest completed in ${duration}ms`);
    } catch (err) {
      // Error already logged in runDailyDigest, but log here too for visibility
      console.error('[scheduledJobs] Daily digest job failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: process.env.DIGEST_TIMEZONE || 'UTC'
  });

  // Weekly digest: Every Monday at 9:00 AM
  // '0 9 * * 1' = 9:00 AM every Monday (0 = Sunday, 1 = Monday)
  weeklyDigestJob = cron.schedule('0 9 * * 1', async () => {
    const startTime = new Date();
    console.log(`[scheduledJobs] Running weekly digest at ${startTime.toISOString()}`);
    
    try {
      await runWeeklyDigest();
      const duration = Date.now() - startTime.getTime();
      console.log(`[scheduledJobs] Weekly digest completed in ${duration}ms`);
    } catch (err) {
      // Error already logged in runWeeklyDigest, but log here too for visibility
      console.error('[scheduledJobs] Weekly digest job failed:', err.message);
    }
  }, {
    scheduled: true,
    timezone: process.env.DIGEST_TIMEZONE || 'UTC'
  });

    console.log('[scheduledJobs]   - Daily digest: 9:00 AM every day');
    console.log('[scheduledJobs]   - Weekly digest: 9:00 AM every Monday');
  } else {
    console.log('[scheduledJobs] Digest scheduler disabled (ENABLE_DIGEST_SCHEDULER=false)');
  }

  // Escalation resolver (Phase 3): check pending approvals past timeout
  if (ENABLE_ESCALATION_SCHEDULER) {
    escalationJob = cron.schedule('* * * * *', async () => {
      try {
        const r = await escalationTick();
        if (r.processed > 0 && NOTIFICATION_DEBUG) {
          console.log(`[scheduledJobs] Escalation tick: processed=${r.processed} escalated=${r.escalated} failed=${r.failed}`);
        }
      } catch (err) {
        console.error('[scheduledJobs] Escalation tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Escalation resolver: every minute');
  } else {
    console.log('[scheduledJobs] Escalation scheduler disabled (ENABLE_ESCALATION_SCHEDULER=false)');
  }

  // Trash retention: purge items past retentionExpiresAt (excluding legal hold)
  if (ENABLE_TRASH_RETENTION_SCHEDULER) {
    trashRetentionJob = cron.schedule('0 3 * * *', async () => {
      const startTime = new Date();
      console.log(`[scheduledJobs] Running trash retention purge at ${startTime.toISOString()}`);
      try {
        const r = await purgeExpiredRetention();
        const duration = Date.now() - startTime.getTime();
        if (r.purged > 0 || r.failed > 0) {
          console.log(`[scheduledJobs] Trash retention: purged=${r.purged} failed=${r.failed} skipped=${r.skipped} (${duration}ms)`);
        }
      } catch (err) {
        console.error('[scheduledJobs] Trash retention job failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Trash retention: 3:00 AM every day');
  } else {
    console.log('[scheduledJobs] Trash retention scheduler disabled (ENABLE_TRASH_RETENTION_SCHEDULER=false)');
  }

  // Assignment scheduler (Helpdesk): execute delayed/scheduled assignment jobs
  if (ENABLE_ASSIGNMENT_SCHEDULER) {
    assignmentJob = cron.schedule('* * * * *', async () => {
      try {
        const result = await processDueAssignmentJobs();
        if (result.processed > 0 || NOTIFICATION_DEBUG) {
          const parts = [
            `processed=${result.processed}`,
            `completed=${result.completed}`,
            `failed=${result.failed}`,
            `skipped=${result.skipped}`
          ];
          if (result.skipped > 0 && result.skipReasons && Object.keys(result.skipReasons).length > 0) {
            parts.push(`skipReasons=${JSON.stringify(result.skipReasons)}`);
          }
          console.log(`[scheduledJobs] Assignment tick: ${parts.join(' ')}`);
          if (result.failed > 0) {
            console.warn('[scheduledJobs] Assignment tick completed with failures (see job rows for lastError)');
          }
        }
      } catch (err) {
        console.error('[scheduledJobs] Assignment tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Assignment scheduler: every minute');
  } else {
    console.log('[scheduledJobs] Assignment scheduler disabled (ENABLE_ASSIGNMENT_SCHEDULER=false)');
  }

  if (ENABLE_PROCESS_WAIT_RESUME_SCHEDULER) {
    processWaitResumeJob = cron.schedule('* * * * *', async () => {
      try {
        const result = await tickProcessWaitResume();
        if (result.due > 0 || NOTIFICATION_DEBUG) {
          console.log(
            `[scheduledJobs] Process wait resume: tenants=${result.tenantsProcessed} due=${result.due} resumed=${result.resumed} failed=${result.failed}`
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] Process wait resume tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Process wait resume: every minute');
  } else {
    console.log('[scheduledJobs] Process wait resume scheduler disabled (ENABLE_PROCESS_WAIT_RESUME_SCHEDULER=false)');
  }

  if (ENABLE_PROCESS_SCHEDULE_SCHEDULER) {
    processScheduleJob = cron.schedule('* * * * *', async () => {
      try {
        const result = await tickProcessSchedules();
        if (result.due > 0 || NOTIFICATION_DEBUG) {
          console.log(
            `[scheduledJobs] Process schedule: tenants=${result.tenantsProcessed} due=${result.due} started=${result.started} skipped=${result.skipped} failed=${result.failed}`
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] Process schedule tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Process schedule runner: every minute');
  } else {
    console.log('[scheduledJobs] Process schedule runner disabled (ENABLE_PROCESS_SCHEDULE_SCHEDULER=false)');
  }

  if (ENABLE_DEFERRED_AUTOMATION_SCHEDULER) {
    deferredAutomationJob = cron.schedule('* * * * *', async () => {
      try {
        const result = await processDueDeferredAutomationActions();
        if (result.processed > 0 || NOTIFICATION_DEBUG) {
          console.log(
            `[scheduledJobs] Deferred automation tick: processed=${result.processed} completed=${result.completed} rescheduled=${result.rescheduled} failed=${result.failed}`
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] Deferred automation tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Deferred automation: every minute');
  }

  if (ENABLE_BUSINESS_HOURS_KPI_SCHEDULER) {
    const kpiCron = String(process.env.BUSINESS_HOURS_KPI_CRON || '15 3 * * *').trim();
    if (cron.validate(kpiCron)) {
      businessHoursKpiJob = cron.schedule(kpiCron, async () => {
        try {
          const result = await tickBusinessHoursKpiAggregation();
          console.log(
            `[scheduledJobs] Business hours KPI: tenants=${result.tenants} processed=${result.processed} failed=${result.failed}`
          );
        } catch (err) {
          console.error('[scheduledJobs] Business hours KPI tick failed:', err.message);
        }
      }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
      console.log(`[scheduledJobs]   - Business hours KPI aggregation: ${kpiCron}`);
    } else {
      console.error(`[scheduledJobs] Invalid BUSINESS_HOURS_KPI_CRON="${kpiCron}"`);
    }
  }

  if (ENABLE_TARGET_RECALC_SCHEDULER) {
    const targetCron = String(process.env.TARGET_RECALC_CRON || '30 2 * * *').trim();
    const { tickTargetRecalc } = require('./targets/targetRecalcScheduler');
    if (cron.validate(targetCron)) {
      targetRecalcJob = cron.schedule(targetCron, async () => {
        try {
          const result = await tickTargetRecalc();
          console.log(
            `[scheduledJobs] Target recalc: tenants=${result.tenants} processed=${result.processed} failed=${result.failed}`
          );
        } catch (err) {
          console.error('[scheduledJobs] Target recalc tick failed:', err.message);
        }
      }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
      console.log(`[scheduledJobs]   - Target recalc fallback: ${targetCron}`);
    } else {
      console.error(`[scheduledJobs] Invalid TARGET_RECALC_CRON="${targetCron}"`);
    }
  }

  if (ENABLE_MARKETING_SEGMENT_REFRESH_SCHEDULER) {
    const segmentCron = String(process.env.MARKETING_SEGMENT_REFRESH_CRON || '*/15 * * * *').trim();
    if (cron.validate(segmentCron)) {
      marketingSegmentRefreshJob = cron.schedule(segmentCron, async () => {
        try {
          const result = await tickMarketingSegmentRefresh();
          if (result?.skipped) return;
          console.log(
            `[scheduledJobs] Marketing segment refresh: total=${result.total} refreshed=${result.refreshed} failed=${result.failed}`
          );
        } catch (err) {
          console.error('[scheduledJobs] Marketing segment refresh failed:', err.message);
        }
      }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
      console.log(`[scheduledJobs]   - Marketing segment refresh: ${segmentCron}`);
    } else {
      console.error(`[scheduledJobs] Invalid MARKETING_SEGMENT_REFRESH_CRON="${segmentCron}"`);
    }
  }

  if (ENABLE_MARKETING_CAMPAIGN_SCHEDULE_SCHEDULER) {
    const campaignScheduleCron = String(process.env.MARKETING_CAMPAIGN_SCHEDULE_CRON || '* * * * *').trim();
    if (cron.validate(campaignScheduleCron)) {
      marketingCampaignScheduleJob = cron.schedule(campaignScheduleCron, async () => {
        try {
          const result = await tickMarketingCampaignSchedule();
          if (result?.skipped) return;
          if (result.due > 0 || result.sent > 0 || result.failed > 0) {
            console.log(
              `[scheduledJobs] Marketing campaign schedule: due=${result.due} sent=${result.sent} skipped=${result.skipped} failed=${result.failed}`
            );
          }
        } catch (err) {
          console.error('[scheduledJobs] Marketing campaign schedule failed:', err.message);
        }
      }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
      console.log(`[scheduledJobs]   - Marketing campaign schedule: ${campaignScheduleCron}`);
    } else {
      console.error(`[scheduledJobs] Invalid MARKETING_CAMPAIGN_SCHEDULE_CRON="${campaignScheduleCron}"`);
    }
  }

  if (ENABLE_MARKETING_AB_TEST_SCHEDULER) {
    const abTestCron = String(process.env.MARKETING_AB_TEST_CRON || '*/5 * * * *').trim();
    if (cron.validate(abTestCron)) {
      marketingAbTestJob = cron.schedule(abTestCron, async () => {
        try {
          const result = await tickMarketingAbTests();
          if (result?.skipped) return;
          if (result.processed > 0 || result.finalized > 0 || result.failed > 0) {
            console.log(
              `[scheduledJobs] Marketing A/B tests: processed=${result.processed} finalized=${result.finalized} failed=${result.failed}`
            );
          }
        } catch (err) {
          console.error('[scheduledJobs] Marketing A/B test tick failed:', err.message);
        }
      }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
      console.log(`[scheduledJobs]   - Marketing A/B tests: ${abTestCron}`);
    } else {
      console.error(`[scheduledJobs] Invalid MARKETING_AB_TEST_CRON="${abTestCron}"`);
    }
  }

  if (ENABLE_AMDS_POLICY_SYNC_SCHEDULER) {
    const policySyncCron = String(process.env.AMDS_POLICY_SYNC_CRON || '*/5 * * * *').trim();
    if (cron.validate(policySyncCron)) {
      amdsPolicySyncJob = cron.schedule(policySyncCron, async () => {
        try {
          const result = await tickAmdsPolicySyncRetry();
          if (!result || result.attempted === 0) return;
          console.log(
            `[scheduledJobs] AMDS policy sync retry: attempted=${result.attempted} succeeded=${result.succeeded} failed=${result.failed}`
          );
        } catch (err) {
          console.error('[scheduledJobs] AMDS policy sync retry failed:', err.message);
        }
      }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
      console.log(`[scheduledJobs]   - AMDS policy sync retry: ${policySyncCron}`);
    } else {
      console.error(`[scheduledJobs] Invalid AMDS_POLICY_SYNC_CRON="${policySyncCron}"`);
    }
  }

  if (ENABLE_HELPDESK_SLA_SCHEDULER) {
    helpdeskSlaJob = cron.schedule('* * * * *', async () => {
      try {
        const result = await tickHelpdeskSlaNotifications();
        if (result.warningSent > 0 || result.breachSent > 0 || result.escalationsSent > 0 || NOTIFICATION_DEBUG) {
          console.log(
            `[scheduledJobs] Helpdesk SLA tick: processed=${result.processed} warningSent=${result.warningSent} breachSent=${result.breachSent} escalationsSent=${result.escalationsSent || 0}`
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] Helpdesk SLA tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Helpdesk SLA monitor: every minute');
  } else {
    console.log('[scheduledJobs] Helpdesk SLA scheduler disabled (ENABLE_HELPDESK_SLA_SCHEDULER=false)');
  }

  if (ENABLE_SLA_POLICY_SCHEDULER) {
    slaPolicyJob = cron.schedule('* * * * *', async () => {
      try {
        const result = await tickSlaPolicyInstances();
        if (result.breached > 0 || result.warnings > 0 || NOTIFICATION_DEBUG) {
          console.log(
            `[scheduledJobs] SLA policy tick: scanned=${result.scanned} breached=${result.breached} warnings=${result.warnings}`
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] SLA policy tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Generic SLA policy monitor: every minute');
  } else {
    console.log('[scheduledJobs] Generic SLA policy scheduler disabled (ENABLE_SLA_POLICY_SCHEDULER=false)');
  }

  // Gmail personal inbox sync (Phase 5): poll Gmail API on an interval across tenant DBs
  if (ENABLE_GMAIL_INBOX_SYNC_SCHEDULER) {
    const gmailCron = String(process.env.GMAIL_INBOX_SYNC_CRON || '*/5 * * * *').trim();
    const tickGmail = async () => {
      const startTime = new Date();
      try {
        await tickScheduledGmailInboxSync();
      } catch (err) {
        console.error('[scheduledJobs] Gmail inbox sync tick failed:', err.message);
      }
      if (NOTIFICATION_DEBUG) {
        console.log(`[scheduledJobs] Gmail inbox sync tick finished in ${Date.now() - startTime.getTime()}ms`);
      }
    };
    try {
      if (!cron.validate(gmailCron)) {
        console.error(
          `[scheduledJobs] Invalid GMAIL_INBOX_SYNC_CRON="${gmailCron}" — Gmail inbox scheduler not started`
        );
      } else {
        gmailInboxSyncJob = cron.schedule(gmailCron, tickGmail, {
          scheduled: true,
          timezone: process.env.DIGEST_TIMEZONE || 'UTC'
        });
        console.log(`[scheduledJobs]   - Gmail inbox sync: cron "${gmailCron}"`);
      }
    } catch (err) {
      console.error('[scheduledJobs] Gmail inbox sync scheduler failed to start:', err.message);
    }
  } else {
    console.log('[scheduledJobs] Gmail inbox sync scheduler disabled (ENABLE_GMAIL_INBOX_SYNC_SCHEDULER=false)');
  }

  if (process.env.ENABLE_GMAIL_PUSH !== 'false' && String(process.env.GMAIL_PUBSUB_TOPIC || '').includes('/topics/')) {
    const { tickRenewGmailWatches } = require('./gmailWatchRenewalSchedulerService');
    const watchCron = String(process.env.GMAIL_WATCH_RENEW_CRON || '15 4 * * *').trim();
    try {
      if (cron.validate(watchCron)) {
        cron.schedule(watchCron, async () => {
          try {
            const r = await tickRenewGmailWatches();
            if (process.env.GMAIL_INBOX_SYNC_SCHEDULER_DEBUG === 'true') {
              console.log('[scheduledJobs] Gmail watch renewal:', r);
            }
          } catch (err) {
            console.error('[scheduledJobs] Gmail watch renewal failed:', err.message);
          }
        }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
        console.log(`[scheduledJobs]   - Gmail watch renewal: cron "${watchCron}"`);
      }
    } catch (err) {
      console.error('[scheduledJobs] Gmail watch renewal scheduler failed:', err.message);
    }
  }

  if (ENABLE_SNOOZE_WAKE_NOTIFICATION_SCHEDULER) {
    snoozeWakeNotificationJob = cron.schedule('* * * * *', async () => {
      try {
        await tickSnoozeWakeNotifications();
      } catch (err) {
        console.error('[scheduledJobs] Snooze wake notification tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Snooze wake notifications: every minute');
  } else {
    console.log(
      '[scheduledJobs] Snooze wake notification scheduler disabled (ENABLE_SNOOZE_WAKE_NOTIFICATION_SCHEDULER=false)'
    );
  }

  if (ENABLE_APPOINTMENT_REMINDER_SCHEDULER) {
    const reminderCron = String(process.env.APPOINTMENT_REMINDER_CRON || '*/10 * * * *').trim();
    if (!cron.validate(reminderCron)) {
      console.error(
        `[scheduledJobs] Invalid APPOINTMENT_REMINDER_CRON="${reminderCron}" — appointment reminder scheduler not started`
      );
    } else {
      appointmentReminderJob = cron.schedule(
        reminderCron,
        async () => {
          try {
            await tickAppointmentReminders();
          } catch (err) {
            console.error('[scheduledJobs] Appointment reminder tick failed:', err.message);
          }
        },
        { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' }
      );
      console.log(`[scheduledJobs]   - Appointment reminders: cron "${reminderCron}"`);
    }
  } else {
    console.log(
      '[scheduledJobs] Appointment reminder scheduler disabled (ENABLE_APPOINTMENT_REMINDER_SCHEDULER=false)'
    );
  }

  if (ENABLE_QUOTE_EXPIRY_SCHEDULER) {
    const quoteExpiryCron = String(process.env.QUOTE_EXPIRY_CRON || '15 * * * *').trim();
    if (!cron.validate(quoteExpiryCron)) {
      console.error(
        `[scheduledJobs] Invalid QUOTE_EXPIRY_CRON="${quoteExpiryCron}" — quote expiry scheduler not started`
      );
    } else {
      quoteExpiryJob = cron.schedule(
        quoteExpiryCron,
        async () => {
          try {
            await tickQuoteExpiry();
          } catch (err) {
            console.error('[scheduledJobs] Quote expiry tick failed:', err.message);
          }
        },
        { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' }
      );
      console.log(`[scheduledJobs]   - Quote expiry: cron "${quoteExpiryCron}"`);
    }
  } else {
    console.log('[scheduledJobs] Quote expiry scheduler disabled (ENABLE_QUOTE_EXPIRY_SCHEDULER=false)');
  }

  if (ENABLE_DOCUMENT_EXPIRY_NOTIFICATION_SCHEDULER) {
    const documentExpiryCron = String(process.env.DOCUMENT_EXPIRY_NOTIFICATION_CRON || '0 8 * * *').trim();
    if (!cron.validate(documentExpiryCron)) {
      console.error(
        `[scheduledJobs] Invalid DOCUMENT_EXPIRY_NOTIFICATION_CRON="${documentExpiryCron}" — document expiry notification scheduler not started`
      );
    } else {
      documentExpiryNotificationJob = cron.schedule(
        documentExpiryCron,
        async () => {
          try {
            await tickDocumentExpiryNotifications();
          } catch (err) {
            console.error('[scheduledJobs] Document expiry notification tick failed:', err.message);
          }
        },
        { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' }
      );
      console.log(`[scheduledJobs]   - Document expiry notifications: cron "${documentExpiryCron}"`);
    }
  } else {
    console.log(
      '[scheduledJobs] Document expiry notification scheduler disabled (ENABLE_DOCUMENT_EXPIRY_NOTIFICATION_SCHEDULER=false)'
    );
  }

  if (ENABLE_DOCUMENT_EXTERNAL_LINK_SCHEDULER) {
    const externalLinkCron = String(process.env.DOCUMENT_EXTERNAL_LINK_CRON || '30 3 * * *').trim();
    if (!cron.validate(externalLinkCron)) {
      console.error(
        `[scheduledJobs] Invalid DOCUMENT_EXTERNAL_LINK_CRON="${externalLinkCron}" — external link scheduler not started`
      );
    } else {
      documentExternalLinkJob = cron.schedule(
        externalLinkCron,
        async () => {
          try {
            await tickDocumentExternalLinkChecks();
          } catch (err) {
            console.error('[scheduledJobs] Document external link tick failed:', err.message);
          }
        },
        { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' }
      );
      console.log(`[scheduledJobs]   - Document external link checks: cron "${externalLinkCron}"`);
    }
  } else {
    console.log(
      '[scheduledJobs] Document external link scheduler disabled (ENABLE_DOCUMENT_EXTERNAL_LINK_SCHEDULER=false)'
    );
  }

  if (ENABLE_DOCUMENT_OCR_INDEX_SCHEDULER) {
    const ocrIndexCron = String(process.env.DOCUMENT_OCR_INDEX_CRON || '0 * * * *').trim();
    if (!cron.validate(ocrIndexCron)) {
      console.error(
        `[scheduledJobs] Invalid DOCUMENT_OCR_INDEX_CRON="${ocrIndexCron}" — OCR index scheduler not started`
      );
    } else {
      documentOcrIndexJob = cron.schedule(
        ocrIndexCron,
        async () => {
          try {
            await tickDocumentOcrIndex();
          } catch (err) {
            console.error('[scheduledJobs] Document OCR index tick failed:', err.message);
          }
        },
        { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' }
      );
      console.log(`[scheduledJobs]   - Document OCR indexing: cron "${ocrIndexCron}"`);
    }
  } else {
    console.log(
      '[scheduledJobs] Document OCR index scheduler disabled (ENABLE_DOCUMENT_OCR_INDEX_SCHEDULER=false)'
    );
  }

  if (ENABLE_DOCUMENT_RESERVATION_SCHEDULER) {
    const reservationCron = String(process.env.DOCUMENT_RESERVATION_CRON || '*/15 * * * *').trim();
    if (!cron.validate(reservationCron)) {
      console.error(
        `[scheduledJobs] Invalid DOCUMENT_RESERVATION_CRON="${reservationCron}" — reservation scheduler not started`
      );
    } else {
      documentReservationJob = cron.schedule(
        reservationCron,
        async () => {
          try {
            await tickDocumentReservationExpiration();
          } catch (err) {
            console.error('[scheduledJobs] Document reservation tick failed:', err.message);
          }
        },
        { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' }
      );
      console.log(`[scheduledJobs]   - Document reservation expiry: cron "${reservationCron}"`);
    }
  } else {
    console.log(
      '[scheduledJobs] Document reservation scheduler disabled (ENABLE_DOCUMENT_RESERVATION_SCHEDULER=false)'
    );
  }

  if (ENABLE_PLAYBOOK_DELAY_SCHEDULER) {
    playbookDelayJob = cron.schedule('* * * * *', async () => {
      try {
        const result = await processDuePlaybookDelayJobs();
        if (result.processed > 0 || NOTIFICATION_DEBUG) {
          console.log(
            `[scheduledJobs] Playbook delay tick: processed=${result.processed} completed=${result.completed} failed=${result.failed} skipped=${result.skipped}`
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] Playbook delay tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Playbook delay triggers: every minute');
  } else {
    console.log('[scheduledJobs] Playbook delay scheduler disabled (ENABLE_PLAYBOOK_DELAY_SCHEDULER=false)');
  }

  if (ENABLE_PLAYBOOK_ALERT_SCHEDULER) {
    playbookAlertJob = cron.schedule('* * * * *', async () => {
      try {
        const result = await processDuePlaybookAlertJobs();
        if (result.processed > 0 || NOTIFICATION_DEBUG) {
          console.log(
            `[scheduledJobs] Playbook alert tick: processed=${result.processed} completed=${result.completed} failed=${result.failed} skipped=${result.skipped}`
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] Playbook alert tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Playbook alerts: every minute');
  } else {
    console.log('[scheduledJobs] Playbook alert scheduler disabled (ENABLE_PLAYBOOK_ALERT_SCHEDULER=false)');
  }

  if (ENABLE_STALLED_INVITE_SCHEDULER) {
    const { tickStalledInviteNotifications } = require('./onboardingStalledInviteSchedulerService');
    stalledInviteJob = cron.schedule('0 10 * * *', async () => {
      try {
        const result = await tickStalledInviteNotifications();
        console.log(
          `[scheduledJobs] Stalled invite nudges: tenants=${result.tenantsProcessed} notified=${result.notified} errors=${result.errors}`
        );
      } catch (err) {
        console.error('[scheduledJobs] Stalled invite nudges failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Stalled invite nudges: 10:00 AM daily');
  } else {
    console.log('[scheduledJobs] Stalled invite scheduler disabled (ENABLE_STALLED_INVITE_SCHEDULER=false)');
  }

  // Legacy Astra Autopilot + Super Agent schedulers removed with legacy AI (Astra v2 cutover).
  console.log('[scheduledJobs] Astra Autopilot scheduler removed (legacy AI deleted)');
  console.log('[scheduledJobs] Astra Super Agents scheduler removed (legacy AI deleted)');

  if (ENABLE_TRIAL_NUDGE_SCHEDULER) {
    const { tickTrialOnboardingNudges } = require('./onboardingTrialNudgeSchedulerService');
    trialNudgeJob = cron.schedule('0 10 * * *', async () => {
      try {
        const result = await tickTrialOnboardingNudges();
        console.log(
          `[scheduledJobs] Trial onboarding nudges: tenants=${result.tenantsProcessed} sent=${result.sent} skipped=${result.skipped} errors=${result.errors}`
        );
      } catch (err) {
        console.error('[scheduledJobs] Trial onboarding nudges failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Trial onboarding nudges: 10:00 AM daily');
  } else {
    console.log('[scheduledJobs] Trial nudge scheduler disabled (ENABLE_TRIAL_NUDGE_SCHEDULER=false)');
  }

  if (ENABLE_ADDON_TRIAL_EXPIRY_SCHEDULER) {
    const { expireAddonTrials } = require('./addonTrialExpirySchedulerService');
    addonTrialExpiryJob = cron.schedule('5 * * * *', async () => {
      try {
        const result = await expireAddonTrials();
        if (result.expired > 0) {
          console.log(`[scheduledJobs] Addon trial expiry: suspended=${result.expired}`);
        }
      } catch (err) {
        console.error('[scheduledJobs] Addon trial expiry failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Addon trial expiry: hourly at :05');
  } else {
    console.log('[scheduledJobs] Addon trial expiry disabled (ENABLE_ADDON_TRIAL_EXPIRY_SCHEDULER=false)');
  }

  if (ENABLE_COMMERCIAL_BILLING_PERIOD_SCHEDULER) {
    const { tickCommercialBillingPeriods } = require('./commercial/commercialBillingPeriodScheduler');
    commercialBillingPeriodJob = cron.schedule('15 * * * *', async () => {
      try {
        const result = await tickCommercialBillingPeriods();
        if (
          result.applied > 0
          || result.trialsConverted > 0
          || result.renewals > 0
          || result.dunning?.invoicesMarked > 0
        ) {
          console.log(
            `[scheduledJobs] Commercial billing periods applied=${result.applied} trials=${result.trialsConverted} renewals=${result.renewals} dunning=${result.dunning?.invoicesMarked || 0}`
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] Commercial billing period tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Commercial billing periods: hourly at :15');
  } else {
    console.log('[scheduledJobs] Commercial billing period scheduler disabled (ENABLE_COMMERCIAL_BILLING_PERIOD_SCHEDULER=false)');
  }

  if (ENABLE_RELEASE_NOTE_PUBLISH_SCHEDULER) {
    const { tickReleaseNotePublish } = require('./releaseNotePublishScheduler');
    releaseNotePublishJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const result = await tickReleaseNotePublish();
        if (result.published > 0) {
          console.log(`[scheduledJobs] Release notes published: ${result.published}`);
        }
      } catch (err) {
        console.error('[scheduledJobs] Release note publish tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Release note publish: every 5 minutes');
  } else {
    console.log('[scheduledJobs] Release note publish scheduler disabled (ENABLE_RELEASE_NOTE_PUBLISH_SCHEDULER=false)');
  }

  if (ENABLE_ANNOUNCEMENT_LIFECYCLE_SCHEDULER) {
    const { tickAnnouncementLifecycle } = require('./announcementLifecycleSchedulerService');
    announcementLifecycleJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const result = await tickAnnouncementLifecycle();
        if (result.published || result.expired || result.archived) {
          console.log(
            `[scheduledJobs] Announcements lifecycle: published=${result.published} expired=${result.expired} archived=${result.archived}`,
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] Announcement lifecycle tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Announcement lifecycle: every 5 minutes');
  } else {
    console.log('[scheduledJobs] Announcement lifecycle disabled (ENABLE_ANNOUNCEMENT_LIFECYCLE_SCHEDULER=false)');
  }

  if (ENABLE_INTERNAL_CHAT_RETENTION_SCHEDULER) {
    const { tickInternalChatRetention } = require('./internalChatRetentionSchedulerService');
    internalChatRetentionJob = cron.schedule('30 3 * * *', async () => {
      try {
        const result = await tickInternalChatRetention();
        if (result.deleted) {
          console.log(
            `[scheduledJobs] Internal chat retention: tenants=${result.tenantsProcessed} deleted=${result.deleted}`,
          );
        }
      } catch (err) {
        console.error('[scheduledJobs] Internal chat retention tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - Internal chat retention: daily 03:30');
  } else {
    console.log('[scheduledJobs] Internal chat retention disabled (ENABLE_INTERNAL_CHAT_RETENTION_SCHEDULER=false)');
  }

  if (ENABLE_SYSTEM_ANNOUNCEMENT_SCHEDULER) {
    const { tickSystemAnnouncementReminders } = require('./systemAnnouncementService');
    systemAnnouncementJob = cron.schedule('15 9 * * *', async () => {
      try {
        const result = await tickSystemAnnouncementReminders();
        console.log(
          `[scheduledJobs] System announcements: processed=${result.processed} trial=${result.trialUpserts} sub=${result.subUpserts}`,
        );
      } catch (err) {
        console.error('[scheduledJobs] System announcement tick failed:', err.message);
      }
    }, { scheduled: true, timezone: process.env.DIGEST_TIMEZONE || 'UTC' });
    console.log('[scheduledJobs]   - System announcement reminders: daily 09:15');
  } else {
    console.log('[scheduledJobs] System announcements disabled (ENABLE_SYSTEM_ANNOUNCEMENT_SCHEDULER=false)');
  }

  console.log(`[scheduledJobs]   - Timezone: ${process.env.DIGEST_TIMEZONE || 'UTC'}`);
  if (NOTIFICATION_DEBUG) {
    console.log('[scheduledJobs]   - Debug mode: enabled');
  }
}

/**
 * Stop all scheduled jobs (for graceful shutdown).
 */
function stopScheduledJobs() {
  if (dailyDigestJob) {
    dailyDigestJob.stop();
    dailyDigestJob = null;
    console.log('[scheduledJobs] Daily digest job stopped');
  }
  
  if (weeklyDigestJob) {
    weeklyDigestJob.stop();
    weeklyDigestJob = null;
    console.log('[scheduledJobs] Weekly digest job stopped');
  }

  if (escalationJob) {
    escalationJob.stop();
    escalationJob = null;
    console.log('[scheduledJobs] Escalation job stopped');
  }

  if (trashRetentionJob) {
    trashRetentionJob.stop();
    trashRetentionJob = null;
    console.log('[scheduledJobs] Trash retention job stopped');
  }

  if (assignmentJob) {
    assignmentJob.stop();
    assignmentJob = null;
    console.log('[scheduledJobs] Assignment scheduler job stopped');
  }

  if (helpdeskSlaJob) {
    helpdeskSlaJob.stop();
    helpdeskSlaJob = null;
    console.log('[scheduledJobs] Helpdesk SLA scheduler job stopped');
  }

  if (slaPolicyJob) {
    slaPolicyJob.stop();
    slaPolicyJob = null;
    console.log('[scheduledJobs] Generic SLA policy scheduler job stopped');
  }

  if (gmailInboxSyncJob) {
    gmailInboxSyncJob.stop();
    gmailInboxSyncJob = null;
    console.log('[scheduledJobs] Gmail inbox sync job stopped');
  }

  if (snoozeWakeNotificationJob) {
    snoozeWakeNotificationJob.stop();
    snoozeWakeNotificationJob = null;
    console.log('[scheduledJobs] Snooze wake notification job stopped');
  }

  if (appointmentReminderJob) {
    appointmentReminderJob.stop();
    appointmentReminderJob = null;
    console.log('[scheduledJobs] Appointment reminder job stopped');
  }

  if (deferredAutomationJob) {
    deferredAutomationJob.stop();
    deferredAutomationJob = null;
    console.log('[scheduledJobs] Deferred automation job stopped');
  }

  if (businessHoursKpiJob) {
    businessHoursKpiJob.stop();
    businessHoursKpiJob = null;
    console.log('[scheduledJobs] Business hours KPI job stopped');
  }

  if (processWaitResumeJob) {
    processWaitResumeJob.stop();
    processWaitResumeJob = null;
    console.log('[scheduledJobs] Process wait resume job stopped');
  }
  if (processScheduleJob) {
    processScheduleJob.stop();
    processScheduleJob = null;
    console.log('[scheduledJobs] Process schedule job stopped');
  }

  if (targetRecalcJob) {
    targetRecalcJob.stop();
    targetRecalcJob = null;
    console.log('[scheduledJobs] Target recalc job stopped');
  }

  if (quoteExpiryJob) {
    quoteExpiryJob.stop();
    quoteExpiryJob = null;
    console.log('[scheduledJobs] Quote expiry job stopped');
  }
  if (documentExpiryNotificationJob) {
    documentExpiryNotificationJob.stop();
    documentExpiryNotificationJob = null;
    console.log('[scheduledJobs] Document expiry notification job stopped');
  }
  if (documentExternalLinkJob) {
    documentExternalLinkJob.stop();
    documentExternalLinkJob = null;
    console.log('[scheduledJobs] Document external link job stopped');
  }
  if (documentOcrIndexJob) {
    documentOcrIndexJob.stop();
    documentOcrIndexJob = null;
    console.log('[scheduledJobs] Document OCR index job stopped');
  }
  if (documentReservationJob) {
    documentReservationJob.stop();
    documentReservationJob = null;
    console.log('[scheduledJobs] Document reservation job stopped');
  }

  if (playbookDelayJob) {
    playbookDelayJob.stop();
    playbookDelayJob = null;
    console.log('[scheduledJobs] Playbook delay job stopped');
  }

  if (playbookAlertJob) {
    playbookAlertJob.stop();
    playbookAlertJob = null;
    console.log('[scheduledJobs] Playbook alert job stopped');
  }

  if (stalledInviteJob) {
    stalledInviteJob.stop();
    stalledInviteJob = null;
    console.log('[scheduledJobs] Stalled invite job stopped');
  }

  if (trialNudgeJob) {
    trialNudgeJob.stop();
    trialNudgeJob = null;
    console.log('[scheduledJobs] Trial nudge job stopped');
  }
  if (addonTrialExpiryJob) {
    addonTrialExpiryJob.stop();
    addonTrialExpiryJob = null;
    console.log('[scheduledJobs] Addon trial expiry job stopped');
  }
  if (commercialBillingPeriodJob) {
    commercialBillingPeriodJob.stop();
    commercialBillingPeriodJob = null;
    console.log('[scheduledJobs] Commercial billing period job stopped');
  }
  if (releaseNotePublishJob) {
    releaseNotePublishJob.stop();
    releaseNotePublishJob = null;
    console.log('[scheduledJobs] Release note publish job stopped');
  }
  if (announcementLifecycleJob) {
    announcementLifecycleJob.stop();
    announcementLifecycleJob = null;
    console.log('[scheduledJobs] Announcement lifecycle job stopped');
  }
  if (internalChatRetentionJob) {
    internalChatRetentionJob.stop();
    internalChatRetentionJob = null;
    console.log('[scheduledJobs] Internal chat retention job stopped');
  }
  if (systemAnnouncementJob) {
    systemAnnouncementJob.stop();
    systemAnnouncementJob = null;
    console.log('[scheduledJobs] System announcement job stopped');
  }
  if (marketingSegmentRefreshJob) {
    marketingSegmentRefreshJob.stop();
    marketingSegmentRefreshJob = null;
    console.log('[scheduledJobs] Marketing segment refresh job stopped');
  }
  if (marketingCampaignScheduleJob) {
    marketingCampaignScheduleJob.stop();
    marketingCampaignScheduleJob = null;
    console.log('[scheduledJobs] Marketing campaign schedule job stopped');
  }
  if (marketingAbTestJob) {
    marketingAbTestJob.stop();
    marketingAbTestJob = null;
    console.log('[scheduledJobs] Marketing A/B test job stopped');
  }
  if (amdsPolicySyncJob) {
    amdsPolicySyncJob.stop();
    amdsPolicySyncJob = null;
    console.log('[scheduledJobs] AMDS policy sync retry job stopped');
  }
}

/**
 * Manually trigger daily digest (for testing or manual runs).
 */
async function triggerDailyDigest() {
  console.log('[scheduledJobs] Manually triggering daily digest...');
  await runDailyDigest();
}

/**
 * Manually trigger weekly digest (for testing or manual runs).
 */
async function triggerWeeklyDigest() {
  console.log('[scheduledJobs] Manually triggering weekly digest...');
  await runWeeklyDigest();
}

/**
 * Manually trigger trash retention purge (for testing or manual runs).
 */
async function triggerTrashRetention() {
  console.log('[scheduledJobs] Manually triggering trash retention purge...');
  return purgeExpiredRetention();
}

async function triggerGmailInboxSyncTick() {
  console.log('[scheduledJobs] Manually triggering Gmail inbox sync tick...');
  return tickScheduledGmailInboxSync();
}

async function triggerSnoozeWakeNotificationsTick() {
  console.log('[scheduledJobs] Manually triggering snooze wake notification tick...');
  return tickSnoozeWakeNotifications();
}

async function triggerAppointmentRemindersTick() {
  console.log('[scheduledJobs] Manually triggering appointment reminder tick...');
  return tickAppointmentReminders();
}

module.exports = {
  startScheduledJobs,
  stopScheduledJobs,
  triggerDailyDigest,
  triggerWeeklyDigest,
  triggerTrashRetention,
  triggerGmailInboxSyncTick,
  triggerSnoozeWakeNotificationsTick,
  triggerAppointmentRemindersTick
};

