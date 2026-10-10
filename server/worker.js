/**
 * Background worker: Bull consumers, cron, and interval schedulers.
 * Run the API with `npm start` and this process with `npm run worker`.
 * Every Worker VM runs this same file. Cron ticks take a Redis lock so only one Worker executes each tick.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const { validateEnv } = require('./config/validateEnv');
const { getMongoUris, connectMasterWithRetry, MASTER_DB } = require('./lib/mongoConnect');
const { initSentryNode, flushSentry } = require('./lib/sentryNode');

validateEnv();
initSentryNode();

const emailQueueService = require('./services/emailQueueService');
const inboundEmailQueueService = require('./services/inboundEmailQueueService');
const importQueueService = require('./services/import/importQueueService');
const dbConnectionManager = require('./utils/databaseConnectionManager');

let exiting = false;

async function run() {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.error('[worker] Set REDIS_URL (recommended) or REDIS_HOST for Bull/Redis.');
    process.exit(1);
  }

  let masterUri;
  let baseUri;
  let mongoQueryString;
  try {
    const u = getMongoUris();
    masterUri = u.masterUri;
    baseUri = u.baseUri;
    mongoQueryString = u.mongoQueryString;
  } catch (e) {
    console.error('[worker]', e.message);
    process.exit(1);
  }
  await connectMasterWithRetry(masterUri);
  console.log(`[worker] MongoDB connected: ${MASTER_DB}`);

  dbConnectionManager.baseMongoUri = baseUri;
  dbConnectionManager.connectionQuery = mongoQueryString;
  await dbConnectionManager.initializeMasterConnection();

  const automationEngine = require('./services/automationEngine');
  automationEngine.init();
  const processExecutor = require('./services/processExecutor');
  processExecutor.init();
  const targetContributionEngine = require('./services/targets/targetContributionEngine');
  targetContributionEngine.init();
  console.log('[worker] Domain-event listeners initialized');

  const scheduledJobs = require('./services/scheduledJobs');
  scheduledJobs.startScheduledJobs();
  console.log('[worker] Scheduled jobs started');

  const { startAnalyticsAlertScheduler } = require('./services/analytics/analyticsAlertScheduler');
  startAnalyticsAlertScheduler();
  const { startTallySyncScheduler } = require('./services/connectors/tally/tallySyncScheduler');
  startTallySyncScheduler();
  const { startMailroomFailureRetryWorker } = require('./platform/mailroom/workers/processingFailureRetryWorker');
  startMailroomFailureRetryWorker();

  if (process.env.ENABLE_HEALTH_CHECKER !== 'false') {
    const healthChecker = require('./services/monitoring/healthChecker');
    healthChecker.start();
    console.log('[worker] Health checker started');
  }
  if (process.env.ENABLE_METRICS_COLLECTOR !== 'false') {
    const metricsCollector = require('./services/monitoring/metricsCollector');
    metricsCollector.start();
    console.log('[worker] Metrics collector started');
  }

  emailQueueService.startWorker();
  console.log(`[worker] Email queue worker is running (Bull: ${emailQueueService.COMMUNICATION_QUEUE_NAMES.EMAIL_SEND})`);

  inboundEmailQueueService.startWorker();
  console.log(`[worker] Inbound email worker is running (Bull: ${inboundEmailQueueService.COMMUNICATION_INBOUND_QUEUE_NAMES.EMAIL_INBOUND})`);

  importQueueService.startWorker();
  console.log(`[worker] Import CSV worker is running (Bull: ${importQueueService.IMPORT_QUEUE_NAME})`);

  const analyticsQueueService = require('./services/analytics/analyticsQueueService');
  analyticsQueueService.startWorker();
  console.log(`[worker] Analytics execute worker is running (Bull: ${analyticsQueueService.ANALYTICS_EXECUTE_QUEUE_NAME})`);

  const analyticsScheduleQueueService = require('./services/analytics/analyticsScheduleQueueService');
  analyticsScheduleQueueService.startWorker();
  console.log(`[worker] Analytics schedule worker is running (Bull: ${analyticsScheduleQueueService.ANALYTICS_SCHEDULE_QUEUE_NAME})`);

  const campaignSendQueueService = require('./services/marketing/campaignSendQueueService');
  campaignSendQueueService.startWorker();
  console.log(`[worker] Campaign send worker is running (Bull: ${campaignSendQueueService.CAMPAIGN_SEND_QUEUE_NAME})`);

  const aiEmbedQueueService = require('./services/ai/aiEmbedQueueService');
  aiEmbedQueueService.startWorker();
  console.log(`[worker] AI embed worker is running (Bull: ${aiEmbedQueueService.AI_EMBED_QUEUE_NAME})`);

  const tallySyncQueueService = require('./services/connectors/tally/tallySyncQueueService');
  tallySyncQueueService.startWorker();
  console.log(`[worker] Tally sync worker is running (Bull: ${tallySyncQueueService.TALLY_SYNC_QUEUE_NAME})`);

  const telephonyQueueService = require('./services/telephony/telephonyQueueService');
  telephonyQueueService.startWorker();
  console.log(`[worker] Telephony worker is running (Bull: ${telephonyQueueService.TELEPHONY_QUEUE_NAME})`);
}

async function stop(signal) {
  if (exiting) return;
  exiting = true;
  console.log(`[worker] ${signal} received, shutting down...`);
  try {
    const scheduledJobs = require('./services/scheduledJobs');
    scheduledJobs.stopScheduledJobs();
  } catch (e) {
    console.error('[worker] scheduled jobs stop', e.message);
  }
  try {
    const { stopAnalyticsAlertScheduler } = require('./services/analytics/analyticsAlertScheduler');
    stopAnalyticsAlertScheduler();
  } catch (e) {
    console.error('[worker] analytics alert scheduler stop', e.message);
  }
  try {
    const { stopTallySyncScheduler } = require('./services/connectors/tally/tallySyncScheduler');
    stopTallySyncScheduler();
  } catch (e) {
    console.error('[worker] tally scheduler stop', e.message);
  }
  try {
    const { stopMailroomFailureRetryWorker } = require('./platform/mailroom/workers/processingFailureRetryWorker');
    stopMailroomFailureRetryWorker();
  } catch (e) {
    console.error('[worker] mailroom retry stop', e.message);
  }
  try {
    if (process.env.ENABLE_HEALTH_CHECKER !== 'false') {
      const healthChecker = require('./services/monitoring/healthChecker');
      healthChecker.stop();
    }
  } catch (e) {
    console.error('[worker] health checker stop', e.message);
  }
  try {
    if (process.env.ENABLE_METRICS_COLLECTOR !== 'false') {
      const metricsCollector = require('./services/monitoring/metricsCollector');
      metricsCollector.stop();
    }
  } catch (e) {
    console.error('[worker] metrics collector stop', e.message);
  }
  try {
    await emailQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] outbound queue close', e.message);
  }
  try {
    await inboundEmailQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] inbound queue close', e.message);
  }
  try {
    await importQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] import queue close', e.message);
  }
  try {
    const analyticsQueueService = require('./services/analytics/analyticsQueueService');
    await analyticsQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] analytics queue close', e.message);
  }
  try {
    const analyticsScheduleQueueService = require('./services/analytics/analyticsScheduleQueueService');
    await analyticsScheduleQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] analytics schedule queue close', e.message);
  }
  try {
    const campaignSendQueueService = require('./services/marketing/campaignSendQueueService');
    await campaignSendQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] campaign send queue close', e.message);
  }
  try {
    const aiEmbedQueueService = require('./services/ai/aiEmbedQueueService');
    await aiEmbedQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] ai embed queue close', e.message);
  }
  try {
    const tallySyncQueueService = require('./services/connectors/tally/tallySyncQueueService');
    await tallySyncQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] tally sync queue close', e.message);
  }
  try {
    const telephonyQueueService = require('./services/telephony/telephonyQueueService');
    await telephonyQueueService.closeQueue();
  } catch (e) {
    console.error('[worker] telephony queue close', e.message);
  }
  try {
    await mongoose.connection.close();
  } catch (e) {
    console.error('[worker] mongo close', e.message);
  }
  try {
    await flushSentry(2000);
  } catch (e) {
    /* optional */
  }
  process.exit(0);
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

run().catch((err) => {
  console.error('[worker] Fatal:', err);
  process.exit(1);
});
