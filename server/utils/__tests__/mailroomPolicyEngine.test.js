const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildNormalizedMessage } = require('../../platform/mailroom/domain/normalizedMessage');
const { mapParserApiMessageToNormalized, enrichNormalizedMessageWithMailbox } = require('../../platform/mailroom/domain/parsedMessageMappers');
const { evaluate, evaluatePipeline } = require('../../platform/mailroom/policies/policyEngine');
const { getTemplate } = require('../../platform/mailroom/policies/templates/defaultTemplates');
const { validateMailroomConfig } = require('../../platform/mailroom/policies/validators/mailroomPolicyValidator');

describe('mailroom policy engine', () => {
  const template = getTemplate('helpdesk_standard_email');
  const policies = template.policies;

  it('validates default template config', () => {
    const result = validateMailroomConfig({
      enabled: false,
      activeTemplateId: 'helpdesk_standard_email',
      schemaVersion: 1,
      policies: template.policies,
      connectors: template.connectors
    });
    assert.equal(result.ok, true);
  });

  it('threading matches in-reply-to', () => {
    const message = buildNormalizedMessage({
      channel: 'email',
      inReplyTo: '<parent@example.com>',
      subject: 'Re: Help'
    });
    const candidates = {
      messages: [
        {
          externalMessageId: '<parent@example.com>',
          conversationId: 'conv1',
          caseId: 'case1'
        }
      ]
    };
    const result = evaluate('threading', { message, candidates, policies });
    assert.equal(result.matched, true);
    assert.equal(result.signal, 'in_reply_to');
    assert.equal(result.target.caseId, 'case1');
  });

  it('ingest policy matches recipient rules', () => {
    const message = buildNormalizedMessage({
      channel: 'email',
      subject: 'Need support',
      participants: {
        from: { address: 'customer@example.com' },
        to: [{ address: 'support@xyz.com' }]
      }
    });
    const result = evaluate('ingest', {
      message,
      policies: {
        ingest: {
          rules: [
            {
              id: 'r1',
              enabled: true,
              match: 'all',
              conditions: [{ field: 'to', operator: 'contains', value: 'support@xyz.com' }],
              action: { type: 'route_to_case_flow' }
            }
          ],
          defaultAction: { type: 'workspace_only' }
        }
      }
    });
    assert.equal(result.matched, true);
    assert.equal(result.ruleId, 'r1');
    assert.equal(result.action.type, 'route_to_case_flow');
  });

  it('ingest policy matches parser API message recipients', () => {
    const message = mapParserApiMessageToNormalized({
      from: 'customer@example.com',
      to: ['support@xyz.com', 'help@xyz.com'],
      cc: [{ address: 'ops@xyz.com' }],
      subject: 'Need support'
    });
    const toResult = evaluate('ingest', {
      message,
      policies: {
        ingest: {
          rules: [
            {
              id: 'to-rule',
              enabled: true,
              match: 'all',
              conditions: [{ field: 'to', operator: 'contains', value: 'support@xyz.com' }],
              action: { type: 'workspace_only' }
            }
          ],
          defaultAction: { type: 'route_to_case_flow' }
        }
      }
    });
    assert.equal(toResult.matched, true);
    assert.equal(toResult.action.type, 'workspace_only');

    const ccResult = evaluate('ingest', {
      message,
      policies: {
        ingest: {
          rules: [
            {
              id: 'cc-rule',
              enabled: true,
              match: 'all',
              conditions: [{ field: 'cc', operator: 'equals', value: 'ops@xyz.com' }],
              action: { type: 'manual_review' }
            }
          ],
          defaultAction: { type: 'route_to_case_flow' }
        }
      }
    });
    assert.equal(ccResult.matched, true);
    assert.equal(ccResult.action.type, 'manual_review');
  });

  it('ingest policy matches mailbox email when parser message has no to header', () => {
    const message = enrichNormalizedMessageWithMailbox(
      mapParserApiMessageToNormalized({
        from: 'customer@example.com',
        subject: 'Need support'
      }),
      { emailAddress: 'hello@arivusystems.com', routingAddress: 'support+t_m@reply.arivusystems.com', kind: 'group' }
    );
    const result = evaluate('ingest', {
      message,
      policies: {
        ingest: {
          rules: [
            {
              id: 'mailbox-rule',
              enabled: true,
              match: 'all',
              conditions: [{ field: 'to', operator: 'equals', value: 'hello@arivusystems.com' }],
              action: { type: 'route_to_case_flow' }
            }
          ],
          defaultAction: { type: 'workspace_only' }
        }
      }
    });
    assert.equal(result.matched, true);
    assert.equal(result.action.type, 'route_to_case_flow');
  });

  it('ingest disabled matching rule suppresses defaultAction', () => {
    const message = buildNormalizedMessage({
      channel: 'email',
      subject: 'Need support',
      participants: {
        from: { address: 'customer@example.com' },
        to: [{ address: 'hello@arivusystems.com' }]
      }
    });
    const result = evaluate('ingest', {
      message,
      policies: {
        ingest: {
          rules: [
            {
              id: 'case-creation',
              enabled: false,
              match: 'all',
              conditions: [{ field: 'to', operator: 'equals', value: 'hello@arivusystems.com' }],
              action: { type: 'route_to_case_flow' }
            }
          ],
          defaultAction: { type: 'route_to_case_flow' }
        }
      }
    });
    assert.equal(result.matched, false);
    assert.equal(result.ruleId, 'case-creation');
    assert.equal(result.action.type, 'ignore');
    assert.equal(result.suppressedDefault, true);
    assert.equal(result.trace[0].skipped, true);
    assert.equal(result.trace[0].reason, 'disabled');
  });

  it('case_link appends to open case', () => {
    const message = buildNormalizedMessage({ channel: 'email', subject: 'Hi' });
    const candidates = {
      openCases: [{ _id: 'open1', status: 'In Progress' }]
    };
    const result = evaluate('case_link', { message, candidates, policies });
    assert.equal(result.action, 'append');
    assert.equal(result.caseId, 'open1');
  });

  it('case_link creates case when no match', () => {
    const message = buildNormalizedMessage({ channel: 'email', subject: 'New issue' });
    const result = evaluate('case_link', { message, candidates: {}, policies });
    assert.equal(result.action, 'create_case');
    assert.equal(result.caseId, null);
  });

  it('evaluatePipeline returns all policy types', () => {
    const message = buildNormalizedMessage({
      channel: 'email',
      externalMessageId: '<dup@example.com>',
      subject: 'Test'
    });
    const pipeline = evaluatePipeline({
      message,
      candidates: { openCases: [], messages: [] },
      policies
    });
    assert.ok(pipeline.threading);
    assert.ok(pipeline.dedup);
    assert.ok(pipeline.caseLink);
    assert.ok(pipeline.classification);
    assert.ok(pipeline.dispatch);
  });

  it('dedup tolerates missing dedup policy', () => {
    const message = buildNormalizedMessage({ channel: 'email', subject: 'Test' });
    const result = evaluate('dedup', {
      message,
      candidates: { messages: [], conversations: [] },
      policies: {}
    });
    assert.equal(result.isDuplicate, false);
    assert.equal(result.behavior, 'continue');
  });
});
