const AnalyticsAlert = require('../../models/AnalyticsAlert');
const AnalyticsWidget = require('../../models/AnalyticsWidget');
const User = require('../../models/User');
const { runAnalyticsReportWithLogging } = require('./analyticsExecutionService');
const { materializeRuntimePermissionsOnUser } = require('../runtimePermissionResolver');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { evaluateAlertsForWidgetExecution } = require('./analyticsAlertEvaluator');
const { acquireSchedulerLock } = require('../../lib/schedulerLock');

const ALERT_SCHEDULER_INTERVAL_MS = 15 * 60 * 1000;
let schedulerTimer = null;

async function resolveWidgetReport(widget, organizationId) {
  const AnalyticsReport = require('../../models/AnalyticsReport');
  const query = {
    _id: widget.reportId,
    organizationId,
    status: 'published',
  };
  if (widget.reportVersion) query.version = widget.reportVersion;
  return AnalyticsReport.findOne(query).lean();
}

async function evaluateAlertForSchedule(alert) {
  return runWithOrganizationTenantContext(alert.organizationId, async () => {
    const widget = await AnalyticsWidget.findOne({
      _id: alert.widgetId,
      organizationId: alert.organizationId,
      status: 'published',
    }).lean();

    if (!widget) return;

    const user = await User.findById(alert.ownerId || widget.ownerId);
    if (!user) return;
    await materializeRuntimePermissionsOnUser(user);

    const report = await resolveWidgetReport(widget, alert.organizationId);
    if (!report) return;

    const { result } = await runAnalyticsReportWithLogging(report, {
      organizationId: alert.organizationId,
      user,
      preview: false,
    });

    await evaluateAlertsForWidgetExecution({
      organizationId: alert.organizationId,
      widget,
      result,
    });
  });
}

async function runScheduledAlertEvaluation() {
  const acquired = await acquireSchedulerLock('analytics-alert', 14 * 60 * 1000);
  if (!acquired) return;

  const alerts = await AnalyticsAlert.find({ status: 'active' })
    .select('_id organizationId widgetId ownerId')
    .limit(200)
    .lean();

  for (const alert of alerts) {
    try {
      await evaluateAlertForSchedule(alert);
    } catch (err) {
      console.warn('[analyticsAlertScheduler] alert evaluation failed:', alert._id, err?.message || err);
    }
  }
}

function startAnalyticsAlertScheduler() {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    runScheduledAlertEvaluation().catch((err) => {
      console.error('[analyticsAlertScheduler] run failed:', err?.message || err);
    });
  }, ALERT_SCHEDULER_INTERVAL_MS);

  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref();
  }

  setTimeout(() => {
    runScheduledAlertEvaluation().catch((err) => {
      console.error('[analyticsAlertScheduler] initial run failed:', err?.message || err);
    });
  }, 30_000);
}

function stopAnalyticsAlertScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

module.exports = {
  runScheduledAlertEvaluation,
  startAnalyticsAlertScheduler,
  stopAnalyticsAlertScheduler,
};
