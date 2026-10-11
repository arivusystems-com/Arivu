'use strict';

const mongoose = require('mongoose');
const { readMetadata } = require('../../../utils/arivuMetadata');
const Campaign = require('../../../models/Campaign');
const CampaignRecipient = require('../../../models/CampaignRecipient');
const Communication = require('../../../models/Communication');
const { getAmdsClient } = require('../../../config/amds');

const MARKETING_MODULE = 'marketing';
const PRODUCTION_DELIVERED_STATUSES = ['sent', 'delivered', 'opened'];

function isMarketingModule(moduleKey) {
  return String(moduleKey || '').trim().toLowerCase() === MARKETING_MODULE;
}

/**
 * @param {import('../amds-types').AmdsWebhookEvent} event
 * @returns {string|null}
 */
function resolveCampaignIdFromEvent(event) {
  const id =
    event.metadata?.campaign_external_id
    || readMetadata(event.metadata, 'entity_id')
    || null;
  return id ? String(id).trim() : null;
}

/**
 * @param {import('../amds-types').AmdsWebhookEvent} [event]
 * @param {{ metadata?: { isTestSend?: boolean } }|null} [communication]
 */
function isMarketingTestSendEvent(event, communication) {
  if (event?.metadata?.is_test_send === true) return true;
  if (communication?.metadata?.isTestSend === true) return true;
  return false;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 */
function buildCampaignProductionCommunicationFilter(organizationId, campaignId) {
  return {
    organizationId,
    'relatedTo.moduleKey': 'campaigns',
    'relatedTo.recordId': new mongoose.Types.ObjectId(String(campaignId)),
    'metadata.isTestSend': { $ne: true }
  };
}

/**
 * Derive campaign delivery/engagement stats from production sends only.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string|import('mongoose').Types.ObjectId} campaignId
 */
async function computeProductionStatsFromCommunications(organizationId, campaignId) {
  const filter = buildCampaignProductionCommunicationFilter(organizationId, campaignId);

  const [
    delivered,
    failed,
    bounced,
    hardBounced,
    softBounced,
    complaints,
    uniqueOpens,
    uniqueClicks,
    openAgg,
    clickAgg,
    campaign,
    suppressedCount
  ] = await Promise.all([
    Communication.countDocuments({ ...filter, status: { $in: PRODUCTION_DELIVERED_STATUSES } }),
    Communication.countDocuments({ ...filter, status: 'failed' }),
    Communication.countDocuments({ ...filter, status: 'bounced' }),
    Communication.countDocuments({
      ...filter,
      status: 'bounced',
      'metadata.bounceClassification': 'hard'
    }),
    Communication.countDocuments({
      ...filter,
      status: 'bounced',
      'metadata.bounceClassification': 'soft'
    }),
    Communication.countDocuments({ ...filter, status: 'complained' }),
    Communication.countDocuments({
      ...filter,
      $or: [{ status: 'opened' }, { 'metadata.openCount': { $gt: 0 } }]
    }),
    Communication.countDocuments({ ...filter, 'metadata.clickCount': { $gt: 0 } }),
    Communication.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$metadata.openCount', 0] } } } }
    ]),
    Communication.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$metadata.clickCount', 0] } } } }
    ]),
    Campaign.findOne({ _id: campaignId, organizationId })
      .select('stats.totalRecipients stats.skippedUnsubscribed stats.rejected stats.queued')
      .lean(),
    CampaignRecipient.countDocuments({
      organizationId,
      campaignId: new mongoose.Types.ObjectId(String(campaignId)),
      status: 'suppressed'
    })
  ]);

  const totalRecipients = Number(campaign?.stats?.totalRecipients) || 0;
  const totalOpens = Number(openAgg[0]?.total) || 0;
  const totalClicks = Number(clickAgg[0]?.total) || 0;
  const rateBase = totalRecipients > 0 ? totalRecipients : 1;

  return {
    delivered,
    failed,
    bounced,
    hardBounced,
    softBounced,
    complaints,
    uniqueOpens,
    uniqueClicks,
    totalOpens,
    totalClicks,
    skippedUnsubscribed: Number(campaign?.stats?.skippedUnsubscribed) || 0,
    suppressed: suppressedCount,
    rejected: Number(campaign?.stats?.rejected) || 0,
    queued: Number(campaign?.stats?.queued) || 0,
    deliveryRate: totalRecipients > 0 ? delivered / totalRecipients : 0,
    openRate: totalRecipients > 0 ? uniqueOpens / totalRecipients : 0,
    clickRate: totalRecipients > 0 ? uniqueClicks / totalRecipients : 0,
    hardBounceRate: totalRecipients > 0 ? hardBounced / rateBase : 0,
    softBounceRate: totalRecipients > 0 ? softBounced / rateBase : 0,
    complaintRate: totalRecipients > 0 ? complaints / rateBase : 0
  };
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string|import('mongoose').Types.ObjectId} campaignId
 */
async function reconcileCampaignStatsFromCommunications(organizationId, campaignId) {
  if (!mongoose.Types.ObjectId.isValid(String(campaignId))) {
    return null;
  }

  const stats = await computeProductionStatsFromCommunications(organizationId, campaignId);

  await Campaign.updateOne(
    { _id: campaignId, organizationId },
    {
      $set: {
        'stats.delivered': stats.delivered,
        'stats.failed': stats.failed,
        'stats.bounced': stats.bounced,
        'stats.hardBounced': stats.hardBounced,
        'stats.softBounced': stats.softBounced,
        'stats.complaints': stats.complaints,
        'stats.uniqueOpens': stats.uniqueOpens,
        'stats.uniqueClicks': stats.uniqueClicks,
        'stats.totalOpens': stats.totalOpens,
        'stats.totalClicks': stats.totalClicks,
        'stats.deliveryRate': stats.deliveryRate,
        'stats.openRate': stats.openRate,
        'stats.clickRate': stats.clickRate,
        'stats.hardBounceRate': stats.hardBounceRate,
        'stats.softBounceRate': stats.softBounceRate,
        'stats.complaintRate': stats.complaintRate,
        'stats.suppressed': stats.suppressed,
        'stats.reconciledAt': new Date()
      }
    }
  );

  return stats;
}

/**
 * @param {{ campaignId: string|undefined, type: 'open'|'click', recipient?: string, url?: string, variantKey?: string }} params
 */
async function incrementCampaignEngagement(params) {
  if (!params.campaignId || !mongoose.Types.ObjectId.isValid(String(params.campaignId))) {
    return;
  }

  const incField = params.type === 'open' ? 'stats.uniqueOpens' : 'stats.uniqueClicks';
  const updates = {
    $inc: { [incField]: 1 },
    $set: { 'stats.lastEngagementAt': new Date() }
  };

  await Campaign.updateOne({ _id: params.campaignId }, updates);

  const variantKey = String(params.variantKey || '').trim();
  if (!variantKey) return;

  const variantIncField = params.type === 'open' ? 'variants.$.stats.uniqueOpens' : 'variants.$.stats.uniqueClicks';
  await Campaign.updateOne(
    { _id: params.campaignId, 'variants.key': variantKey },
    {
      $inc: { [variantIncField]: 1 },
      $set: { 'variants.$.stats.lastEngagementAt': new Date() }
    }
  );
}

/**
 * @param {{ campaignId: string|undefined, type: 'delivered'|'failed'|'bounced'|'hard_bounced'|'soft_bounced'|'complained' }} params
 */
async function incrementCampaignDeliveryStat(params) {
  if (!params.campaignId || !mongoose.Types.ObjectId.isValid(String(params.campaignId))) {
    return;
  }

  const fieldMap = {
    delivered: 'stats.delivered',
    failed: 'stats.failed',
    bounced: 'stats.bounced',
    hard_bounced: 'stats.hardBounced',
    soft_bounced: 'stats.softBounced',
    complained: 'stats.complaints'
  };
  const incField = fieldMap[params.type];
  if (!incField) return;

  const inc = { [incField]: 1 };
  if (params.type === 'hard_bounced' || params.type === 'soft_bounced') {
    inc['stats.bounced'] = 1;
  }

  await Campaign.updateOne({ _id: params.campaignId }, { $inc: inc });
}

/**
 * Reconcile campaign stats from AMDS analytics API.
 * @param {string} organizationId
 * @param {string} campaignId
 * @param {import('../amds-types').AnalyticsSummaryResponse} [summaryOverride]
 */
async function syncCampaignStatsFromAmds(organizationId, campaignId, summaryOverride) {
  const client = getAmdsClient();
  if (!client) {
    throw new Error('AMDS is not configured');
  }

  const summary =
    summaryOverride
    || (await client.getAnalyticsSummary({
      tenant_id: String(organizationId),
      campaign_id: String(campaignId)
    }));

  const counts = summary?.counts || {};
  const rates = summary?.rates || {};

  await Campaign.updateOne(
    { _id: campaignId, organizationId },
    {
      $set: {
        'stats.totalOpens': Number(counts.total_opens) || 0,
        'stats.totalClicks': Number(counts.total_clicks) || 0,
        ...(counts.hard_bounced != null
          ? { 'stats.hardBounced': Number(counts.hard_bounced) || 0 }
          : {}),
        ...(counts.soft_bounced != null
          ? { 'stats.softBounced': Number(counts.soft_bounced) || 0 }
          : {}),
        ...(counts.complaints != null ? { 'stats.complaints': Number(counts.complaints) || 0 } : {}),
        ...(counts.bounced != null ? { 'stats.bounced': Number(counts.bounced) || 0 } : {}),
        ...(rates.hard_bounce_rate != null
          ? { 'stats.hardBounceRate': Number(rates.hard_bounce_rate) || 0 }
          : {}),
        ...(rates.soft_bounce_rate != null
          ? { 'stats.softBounceRate': Number(rates.soft_bounce_rate) || 0 }
          : {}),
        ...(rates.complaint_rate != null
          ? { 'stats.complaintRate': Number(rates.complaint_rate) || 0 }
          : {}),
        'stats.syncedAt': new Date()
      }
    }
  );

  await reconcileCampaignStatsFromCommunications(organizationId, campaignId);

  return summary;
}

module.exports = {
  MARKETING_MODULE,
  isMarketingModule,
  resolveCampaignIdFromEvent,
  isMarketingTestSendEvent,
  buildCampaignProductionCommunicationFilter,
  computeProductionStatsFromCommunications,
  reconcileCampaignStatsFromCommunications,
  incrementCampaignEngagement,
  incrementCampaignDeliveryStat,
  syncCampaignStatsFromAmds
};
