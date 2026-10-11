'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const tenantContext = require('../../utils/runWithOrganizationTenant');
const sendService = require('../../services/marketing/sendCampaignBatch');
const campaignSendOrchestrator = require('../../services/marketing/campaignSendOrchestrator');
const audienceService = require('../../services/marketing/marketingAudienceService');
const amdsConfig = require('../../config/amds');
const campaignStatsHandler = require('../../services/amds/handlers/campaignStatsHandler');
const validationService = require('../../services/marketing/marketingCampaignContentValidationService');
const testSendService = require('../../services/marketing/sendCampaignTest');
const scheduleService = require('../../services/marketing/marketingCampaignScheduleService');
const orgEmailPolicyService = require('../../services/orgEmailPolicyService');
const creditPrecheckService = require('../../services/marketing/marketingCampaignCreditPrecheckService');

const Campaign = require('../../models/Campaign');
const CampaignRecipient = require('../../models/CampaignRecipient');
const Communication = require('../../models/Communication');

function loadController() {
  const controllerPath = require.resolve('../marketingCampaignController');
  delete require.cache[controllerPath];
  return require('../marketingCampaignController');
}

const orgId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const campaignId = new mongoose.Types.ObjectId();

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function patchMethod(target, key, replacement, t) {
  const original = target[key];
  target[key] = replacement;
  t.after(() => {
    target[key] = original;
  });
}

function baseReq(overrides = {}) {
  return {
    user: { _id: userId, organizationId: orgId },
    params: { id: String(campaignId) },
    query: {},
    body: {},
    ...overrides
  };
}

function createNext() {
  return (err) => {
    if (err) throw err;
  };
}

test('getCampaignSendPolicy returns tenant send stats', async (t) => {
  const orgEmailPolicyService = require('../../services/orgEmailPolicyService');
  patchMethod(orgEmailPolicyService, 'ensureOrgEmailPolicy', async () => ({}), t);
  patchMethod(orgEmailPolicyService, 'refreshOrgEmailReputation', async () => null, t);
  patchMethod(orgEmailPolicyService, 'refreshOrgEmailThroughput', async () => null, t);
  patchMethod(orgEmailPolicyService, 'getOrgEmailPolicy', async () => ({
    creditsRemaining: 80_000,
    senderReputation: 86,
    effectiveHourlyRate: 3750,
    maxHourlyRate: 5000
  }), t);
  patchMethod(orgEmailPolicyService, 'serializeOrgEmailPolicy', (doc) => ({
    creditsRemaining: doc.creditsRemaining,
    senderReputation: doc.senderReputation,
    effectiveHourlyRate: doc.effectiveHourlyRate,
    maxHourlyRate: doc.maxHourlyRate
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.getCampaignSendPolicy(baseReq({ params: {} }), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.creditsRemaining, 80_000);
  assert.equal(res.body.data.marketingMinSenderReputation, 40);
});

test('listCampaigns returns paginated campaigns scoped to organization', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'find', (match) => {
    assert.equal(String(match.organizationId), String(orgId));
    return {
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => [{ _id: campaignId, name: 'Summer promo', status: 'draft' }]
          })
        })
      })
    };
  }, t);
  patchMethod(Campaign, 'countDocuments', async (match) => {
    assert.equal(String(match.organizationId), String(orgId));
    return 1;
  }, t);
  patchMethod(Campaign, 'aggregate', async (pipeline) => {
    assert.equal(String(pipeline[0].$match.organizationId), String(orgId));
    return [{ _id: 'draft', count: 1 }];
  }, t);

  const req = baseReq({ params: {}, query: { page: '1', limit: '10', search: 'summer' } });
  const res = createRes();

  const controller = loadController();
  await controller.listCampaigns(req, res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.pagination.total, 1);
  assert.equal(res.body.listStatistics.draft, 1);
});

test('createCampaign rejects missing name', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  const res = createRes();
  const controller = loadController();
  await controller.createCampaign(baseReq({ params: {}, body: { name: '  ' } }), res, createNext());
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body.message), /name is required/i);
});

test('createCampaign creates draft campaign', async (t) => {
  let created = null;
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'create', async (payload) => {
    created = payload;
    return { _id: campaignId, ...payload };
  }, t);

  const res = createRes();
  const controller = loadController();
  await controller.createCampaign(
    baseReq({
      params: {},
      body: {
        name: 'Launch',
        subject: 'Hello',
        fromEmail: 'news@example.com',
        bodyHtml: '<p>Hi</p>'
      }
    }),
    res,
    createNext()
  );

  assert.equal(res.statusCode, 201);
  assert.equal(created.name, 'Launch');
  assert.equal(created.organizationId, orgId);
});

test('getCampaign returns 404 when not found', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', () => ({ lean: async () => null }), t);

  const res = createRes();
  const controller = loadController();
  await controller.getCampaign(baseReq(), res, createNext());
  assert.equal(res.statusCode, 404);
});

test('updateCampaign rejects edit on completed campaign', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', async () => ({
    status: 'completed',
    toObject() {
      return { status: 'completed' };
    }
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.updateCampaign(baseReq({ body: { name: 'Updated' } }), res, createNext());
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body.message), /draft or scheduled/i);
});

test('updateCampaign saves editable campaign', async (t) => {
  let saved = false;
  const doc = {
    status: 'draft',
    name: 'Old',
    async save() {
      saved = true;
    },
    toObject() {
      return { _id: campaignId, status: 'draft', name: 'New name' };
    }
  };

  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', async () => doc, t);

  const res = createRes();
  const controller = loadController();
  await controller.updateCampaign(baseReq({ body: { name: 'New name' } }), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(doc.name, 'New name');
  assert.equal(saved, true);
});

test('deleteCampaign blocks active campaigns', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', async () => ({
    status: 'running',
    sendState: { phase: 'idle' },
    async deleteOne() {}
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.deleteCampaign(baseReq(), res, createNext());
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Cancel the campaign/);
});

test('deleteCampaign removes draft campaign and recipient snapshot rows', async (t) => {
  let deleted = false;
  let recipientsDeleted = false;
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(CampaignRecipient, 'deleteMany', async () => {
    recipientsDeleted = true;
    return { deletedCount: 0 };
  }, t);
  patchMethod(Campaign, 'findOne', async () => ({
    status: 'draft',
    sendState: { phase: 'idle' }
  }), t);
  patchMethod(Campaign, 'deleteOne', async () => {
    deleted = true;
    return { deletedCount: 1 };
  }, t);

  const res = createRes();
  const controller = loadController();
  await controller.deleteCampaign(baseReq(), res, createNext());
  assert.equal(res.statusCode, 200);
  assert.equal(deleted, true);
  assert.equal(recipientsDeleted, true);
});

test('deleteCampaign removes completed campaign', async (t) => {
  let deleted = false;
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(CampaignRecipient, 'deleteMany', async () => ({ deletedCount: 0 }), t);
  patchMethod(Campaign, 'findOne', async () => ({
    status: 'completed',
    sendState: { phase: 'idle' }
  }), t);
  patchMethod(Campaign, 'deleteOne', async () => {
    deleted = true;
    return { deletedCount: 1 };
  }, t);

  const res = createRes();
  const controller = loadController();
  await controller.deleteCampaign(baseReq(), res, createNext());
  assert.equal(res.statusCode, 200);
  assert.equal(deleted, true);
});

test('duplicateCampaign creates draft copy', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', () => ({
    lean: async () => ({
      name: 'Original',
      subject: 'Sub',
      bodyHtml: '<p>x</p>',
      bodyText: '',
      fromEmail: 'a@b.com',
      fromName: 'Brand',
      trackOpens: true,
      trackClicks: true,
      campaignType: 'standard'
    })
  }), t);
  patchMethod(Campaign, 'create', async (payload) => {
    assert.equal(payload.status, 'draft');
    assert.match(payload.name, /copy/i);
    return { _id: new mongoose.Types.ObjectId(), ...payload };
  }, t);

  const res = createRes();
  const controller = loadController();
  await controller.duplicateCampaign(baseReq(), res, createNext());
  assert.equal(res.statusCode, 201);
});

test('cancelCampaign transitions running to cancelled', async (t) => {
  const doc = {
    status: 'running',
    async save() {},
    toObject() {
      return { _id: campaignId, status: this.status };
    }
  };
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', async () => doc, t);

  const res = createRes();
  const controller = loadController();
  await controller.cancelCampaign(baseReq(), res, createNext());
  assert.equal(res.statusCode, 200);
  assert.equal(doc.status, 'cancelled');
});

test('listCampaignRecipients maps communication rows and excludes test sends', async (t) => {
  let capturedFilter = null;
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', () => ({
    select: () => ({ lean: async () => ({ _id: campaignId }) })
  }), t);
  patchMethod(CampaignRecipient, 'countDocuments', async () => 0, t);
  patchMethod(Communication, 'find', (filter) => {
    capturedFilter = filter;
    return {
      sort: () => ({
        skip: () => ({
          limit: () => ({
            select: () => ({
              lean: async () => [
                {
                  _id: new mongoose.Types.ObjectId(),
                  toAddresses: ['user@example.com'],
                  status: 'delivered',
                  metadata: { recipientId: 'p1', openCount: 2, clickCount: 1 },
                  createdAt: new Date()
                }
              ]
            })
          })
        })
      })
    };
  }, t);
  patchMethod(Communication, 'countDocuments', async () => 1, t);

  const res = createRes();
  const controller = loadController();
  await controller.listCampaignRecipients(baseReq(), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].email, 'user@example.com');
  assert.equal(res.body.data[0].openCount, 2);
  assert.deepEqual(capturedFilter['metadata.isTestSend'], { $ne: true });
});

test('listCampaignRecipients prefers CampaignRecipient snapshot rows enriched with communications', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', () => ({
    select: () => ({ lean: async () => ({ _id: campaignId }) })
  }), t);
  patchMethod(CampaignRecipient, 'countDocuments', async () => 1, t);
  patchMethod(CampaignRecipient, 'find', () => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({
          lean: async () => [
            {
              _id: new mongoose.Types.ObjectId(),
              email: 'scale-test-0@example.com',
              recipientId: 'scale-recipient-0',
              status: 'queued',
              errorCode: null,
              createdAt: new Date()
            }
          ]
        })
      })
    })
  }), t);
  patchMethod(Communication, 'find', () => ({
    select: () => ({
      lean: async () => [
        {
          _id: new mongoose.Types.ObjectId(),
          toAddresses: ['scale-test-0@example.com'],
          status: 'delivered',
          sentAt: new Date(),
          metadata: { recipientId: 'scale-recipient-0', openCount: 1, clickCount: 0 },
          createdAt: new Date()
        }
      ]
    })
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.listCampaignRecipients(baseReq(), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].email, 'scale-test-0@example.com');
  assert.equal(res.body.data[0].status, 'delivered');
  assert.equal(res.body.data[0].openCount, 1);
  assert.equal(res.body.pagination.total, 1);
});

test('listCampaignRecipients falls back to linked audience when delivery records are missing', async (t) => {
  const audienceId = new mongoose.Types.ObjectId();
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', () => ({
    select: (fields) => ({
      lean: async () => {
        if (String(fields).includes('audienceId')) {
          return {
            _id: campaignId,
            audienceId,
            stats: { totalRecipients: 2 }
          };
        }
        return { _id: campaignId };
      }
    })
  }), t);
  patchMethod(CampaignRecipient, 'countDocuments', async () => 0, t);
  patchMethod(Communication, 'find', () => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({
          select: () => ({ lean: async () => [] })
        })
      })
    })
  }), t);
  patchMethod(Communication, 'countDocuments', async () => 0, t);
  patchMethod(loadAudienceModule(), 'loadAudience', async () => ({
    memberCount: 2
  }), t);
  patchMethod(loadAudienceModule(), 'resolveAudienceRecipients', async () => [
    { email: 'alice@example.com', recipientId: 'p1', name: 'Alice' },
    { email: 'bob@example.com', recipientId: 'p2', name: 'Bob' }
  ], t);

  const res = createRes();
  const controller = loadController();
  await controller.listCampaignRecipients(baseReq(), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.pagination.total, 2);
  assert.equal(res.body.data[0].email, 'alice@example.com');
  assert.equal(res.body.data[0].status, 'sent');
});

function loadAudienceModule() {
  return require('../../services/marketing/marketingAudienceService');
}

function patchMarketingSendAllowed(t) {
  patchMethod(orgEmailPolicyService, 'assertMarketingSendAllowed', async () => ({ allowed: true }), t);
  patchMethod(campaignSendOrchestrator, 'assertCampaignSendPolicy', async () => {}, t);
}

test('sendCampaign resolves audienceId to recipients', async (t) => {
  const audienceObjectId = new mongoose.Types.ObjectId();
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', async () => ({
    status: 'draft',
    approvalStatus: 'approved',
    audienceId: audienceObjectId
  }), t);
  patchMethod(Campaign, 'updateOne', async () => ({ acknowledged: true }), t);
  patchMethod(amdsConfig, 'isAmdsEnvConfigured', () => true, t);
  patchMarketingSendAllowed(t);
  patchMethod(audienceService, 'loadAudience', async () => ({
    _id: audienceObjectId,
    type: 'static',
    members: [{ email: 'member@example.com', recipientId: 'member@example.com' }]
  }), t);
  patchMethod(campaignSendOrchestrator, 'enqueueCampaignSend', async () => ({
    mode: 'queued',
    jobId: 'job-audience',
    phase: 'queued',
    recipientCount: 0
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.sendCampaign(
    baseReq({ body: { audienceId: String(audienceObjectId) } }),
    res,
    createNext()
  );

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.success, true);
});

test('sendCampaign requires approval before send', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', async () => ({ status: 'draft', approvalStatus: 'none' }), t);
  patchMethod(amdsConfig, 'isAmdsEnvConfigured', () => true, t);

  const res = createRes();
  const controller = loadController();
  await controller.sendCampaign(
    baseReq({
      body: {
        recipients: [{ email: 'user@example.com', recipientId: 'user@example.com' }]
      }
    }),
    res,
    createNext()
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /approved/i);
});

test('sendCampaign requires inline recipients', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', async () => ({ status: 'draft', approvalStatus: 'approved' }), t);
  patchMethod(amdsConfig, 'isAmdsEnvConfigured', () => true, t);
  patchMarketingSendAllowed(t);

  const res = createRes();
  const controller = loadController();
  await controller.sendCampaign(baseReq({ body: { recipients: [] } }), res, createNext());
  assert.equal(res.statusCode, 400);
});

test('sendCampaign blocks low sender reputation', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', async () => ({ status: 'draft', approvalStatus: 'approved' }), t);
  patchMethod(amdsConfig, 'isAmdsEnvConfigured', () => true, t);
  patchMethod(orgEmailPolicyService, 'assertMarketingSendAllowed', async () => ({
    allowed: false,
    code: 'MARKETING_RESTRICTED',
    error: 'Sender reputation too low for marketing sends'
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.sendCampaign(
    baseReq({ body: { recipients: [{ email: 'a@example.com', recipientId: 'r1' }] } }),
    res,
    createNext()
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'MARKETING_RESTRICTED');
});

test('sendCampaign delegates to campaign send orchestrator', async (t) => {
  let batchArgs = null;
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', async () => ({ status: 'draft', approvalStatus: 'approved' }), t);
  patchMethod(Campaign, 'updateOne', async () => ({ acknowledged: true }), t);
  patchMethod(amdsConfig, 'isAmdsEnvConfigured', () => true, t);
  patchMarketingSendAllowed(t);
  patchMethod(campaignSendOrchestrator, 'enqueueCampaignSend', async (args) => {
    batchArgs = args;
    return { mode: 'inline', jobId: 'job-test', phase: 'queued', recipientCount: args.recipients.length };
  }, t);
  patchMethod(sendService, 'sendCampaignBatch', async () => ({ accepted: 1, rejected: 0 }), t);

  const recipients = [{ email: 'a@example.com', recipientId: 'r1' }];
  const res = createRes();
  const controller = loadController();
  await controller.sendCampaign(baseReq({ body: { recipients } }), res, createNext());

  assert.equal(res.statusCode, 202);
  assert.equal(batchArgs.recipients[0].email, recipients[0].email);
  assert.equal(batchArgs.recipients[0].recipientId, recipients[0].recipientId);
  assert.equal(res.body.data.jobId, 'job-test');
});

test('getCampaignAnalytics reconciles local stats when AMDS not configured', async (t) => {
  let reconciled = false;
  patchMethod(amdsConfig, 'getAmdsClient', () => null, t);
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(campaignStatsHandler, 'reconcileCampaignStatsFromCommunications', async () => {
    reconciled = true;
  }, t);
  patchMethod(Campaign, 'findOne', () => ({
    lean: async () => ({
      _id: campaignId,
      stats: { delivered: 2 },
      status: 'running'
    }),
    select: () => ({
      lean: async () => ({
        stats: { delivered: 2 },
        status: 'running'
      })
    })
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.getCampaignAnalytics(baseReq(), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(reconciled, true);
  assert.equal(res.body.data.stats.delivered, 2);
});

test('getCampaignAnalytics falls back to local stats when AMDS is unreachable', async (t) => {
  let reconciled = false;
  patchMethod(amdsConfig, 'getAmdsClient', () => ({
    getAnalyticsSummary: async () => {
      throw new Error('connect ECONNREFUSED');
    }
  }), t);
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(campaignStatsHandler, 'reconcileCampaignStatsFromCommunications', async () => {
    reconciled = true;
  }, t);
  patchMethod(Campaign, 'findOne', () => ({
    lean: async () => ({
      _id: campaignId,
      stats: { delivered: 2 },
      status: 'running'
    }),
    select: () => ({
      lean: async () => ({
        stats: { delivered: 2 },
        status: 'running'
      })
    })
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.getCampaignAnalytics(baseReq(), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(reconciled, true);
  assert.equal(res.body.data.amdsUnavailable, true);
});

test('getCampaignAnalytics syncs stats when AMDS configured', async (t) => {
  let synced = false;
  patchMethod(amdsConfig, 'isAmdsEnvConfigured', () => true, t);
  patchMethod(amdsConfig, 'getAmdsClient', () => ({
    getAnalyticsSummary: async () => ({ delivered: 5 })
  }), t);
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(campaignStatsHandler, 'syncCampaignStatsFromAmds', async () => {
    synced = true;
  }, t);
  patchMethod(Campaign, 'findOne', () => ({
    lean: async () => ({
      _id: campaignId,
      stats: { delivered: 4 },
      status: 'completed'
    }),
    select: () => ({
      lean: async () => ({
        stats: { delivered: 5 },
        status: 'completed'
      })
    })
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.getCampaignAnalytics(baseReq(), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(synced, true);
  assert.equal(res.body.data.stats.delivered, 5);
});

test('getCampaignPrecheck returns validation checklist', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(Campaign, 'findOne', () => ({
    lean: async () => ({
      _id: campaignId,
      fromEmail: 'news@example.com',
      subject: 'Hello',
      bodyHtml: '<p>Hi</p>'
    })
  }), t);
  patchMethod(validationService, 'validateCampaignContent', () => ({
    ready: true,
    checks: [{ key: 'body', status: 'ok' }],
    unresolvedMergeTags: [],
    conditionalBlockCount: 0
  }), t);
  patchMethod(creditPrecheckService, 'buildCampaignCreditPrecheckChecks', async () => ({
    checks: [{ key: 'senderReputation', status: 'ok', message: 'Sender reputation: 86 / 100' }],
    credits: { recipientCount: 100, creditsNeeded: 100, creditsRemaining: 500 },
    throughput: {
      maxHourlyRate: 5000,
      effectiveHourlyRate: 3750,
      senderReputation: 86,
      warmupStage: 'stage_2'
    }
  }), t);
  patchMethod(creditPrecheckService, 'fetchCampaignSendEstimate', async () => ({
    estimatedSeconds: 3600,
    estimatedCompletion: '2026-07-02T13:00:00.000Z',
    throughput: {
      maxHourlyRate: 5000,
      effectiveHourlyRate: 3750,
      senderReputation: 86,
      warmupStage: 'stage_2'
    }
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.getCampaignPrecheck(baseReq({ query: { recipientCount: '100' } }), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.ready, true);
  assert.equal(res.body.data.throughput.effectiveHourlyRate, 3750);
  assert.equal(res.body.data.estimate.estimatedSeconds, 3600);
});

test('scheduleCampaign requires scheduledAt', async (t) => {
  const res = createRes();
  const controller = loadController();
  await controller.scheduleCampaign(baseReq({ body: {} }), res, createNext());
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body.message), /scheduledAt/i);
});

test('scheduleCampaign stores future send', async (t) => {
  patchMarketingSendAllowed(t);
  patchMethod(scheduleService, 'scheduleCampaignSend', async () => ({
    _id: campaignId,
    status: 'scheduled',
    scheduledAt: new Date(Date.now() + 60_000)
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.scheduleCampaign(
    baseReq({
      body: {
        scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        timezone: 'UTC',
        audienceId: String(new mongoose.Types.ObjectId())
      }
    }),
    res,
    createNext()
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.status, 'scheduled');
});

test('testSendCampaign requires email', async (t) => {
  patchMethod(amdsConfig, 'isAmdsEnvConfigured', () => true, t);

  const res = createRes();
  const controller = loadController();
  await controller.testSendCampaign(baseReq({ body: {} }), res, createNext());
  assert.equal(res.statusCode, 400);
});

test('testSendCampaign delegates to sendCampaignTest', async (t) => {
  patchMethod(amdsConfig, 'isAmdsEnvConfigured', () => true, t);
  patchMethod(testSendService, 'sendCampaignTest', async () => ({
    messageId: 'msg-1',
    communicationId: new mongoose.Types.ObjectId(),
    unresolvedMergeTags: 0
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.testSendCampaign(
    baseReq({ body: { email: 'test@example.com', name: 'Test User' } }),
    res,
    createNext()
  );

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.data.messageId, 'msg-1');
});
