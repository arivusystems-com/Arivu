'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const bootstrap = require('../../bootstrap');
const toolRegistry = require('../../tools/toolRegistry');
const agentRegistry = require('../../agents/agentRegistry');
const { planCrmSearch } = require('../../tools/families');
const { runOrchestrator, classifyIntent, buildGroundedAnswer } = require('../../orchestrator/runOrchestrator');
const { runGoldenSet } = require('../goldenIntent');
const { runWorkflowAgent } = require('../../agents/workflowAgent');
const { DEAL_STATUS } = require('../../../../constants/dealStatus');

// --- test helpers -----------------------------------------------------------

/** A mock mongoose-ish model with a chainable find() and countDocuments(). */
function mockModel(rows) {
  return {
    find() {
      const chain = {
        sort() { return chain; },
        limit() { return chain; },
        lean: async () => rows,
      };
      return chain;
    },
    countDocuments: async () => rows.length,
  };
}

const ORG = '507f1f77bcf86cd799439011';

/** Intent JSON first, polished prose on answer-polish calls. */
function intentThenPolishLlm(intentPayload, polishText) {
  return async (messages) => {
    const blob = JSON.stringify(messages);
    if (/LEAD HINT|Respond as Astra/i.test(blob)) {
      return { text: polishText, usage: {} };
    }
    return {
      text: typeof intentPayload === 'string' ? intentPayload : JSON.stringify(intentPayload),
      usage: {},
    };
  };
}

function dealsDeps(rows) {
  return { models: { Deal: mockModel(rows) }, audit: false, llmIntent: false };
}

// --- tests ------------------------------------------------------------------

describe('astra v2 — bootstrap', () => {
  beforeEach(() => {
    bootstrap.resetForTests();
  });

  it('registers tools and agents idempotently', () => {
    const first = bootstrap.bootstrapAstra();
    assert.ok(first.tools.some((t) => t.name === 'search.crm'));
    assert.ok(first.tools.some((t) => t.name === 'crm.deals'));
    assert.ok(first.tools.some((t) => t.name === 'email.send'));
    assert.ok(first.tools.some((t) => t.name === 'crm.tasks.create'));
    assert.ok(first.agents.some((a) => a.name === 'mission-control'));
    assert.ok(first.agents.some((a) => a.name === 'summary'));
    assert.ok(first.agents.some((a) => a.name === 'coworker')); // soft-alias

    // running twice must not throw or duplicate
    const second = bootstrap.bootstrapAstra();
    assert.equal(
      toolRegistry.listTools().length,
      second.tools.length,
    );
    assert.ok(agentRegistry.hasAgent('deal-intelligence'));
  });

  it('ensureBootstrapped self-heals a cold registry', () => {
    bootstrap.resetForTests();
    assert.equal(toolRegistry.hasTool('search.crm'), false);
    bootstrap.ensureBootstrapped();
    assert.equal(toolRegistry.hasTool('search.crm'), true);
  });
});

describe('astra v2 — planCrmSearch (hardened)', () => {
  it('plans "list all open deals" without regexing the sentence', () => {
    const plan = planCrmSearch('list all open deals', { organizationId: ORG });
    assert.equal(plan.entity, 'deals');
    assert.equal(plan.listIntent, true);
    assert.equal(plan.openOnly, true);
    assert.equal(plan.searchTerm, null);
    assert.equal(plan.filter.status, DEAL_STATUS.OPEN);
    assert.equal(plan.filter.deletedAt, null);
    assert.ok(plan.filter.organizationId, 'org id is applied');
    // CRITICAL: the full sentence must NOT become a name regex
    assert.equal(plan.filter.name, undefined);
  });

  it('lists open deals by default for a bare "show me my deals"', () => {
    const plan = planCrmSearch('show me my deals', { organizationId: ORG });
    assert.equal(plan.entity, 'deals');
    assert.equal(plan.openOnly, true);
    assert.equal(plan.filter.status, DEAL_STATUS.OPEN);
    assert.equal(plan.filter.name, undefined);
  });

  it('does NOT force open-only when the user asks for won deals', () => {
    const plan = planCrmSearch('show me won deals', { organizationId: ORG });
    assert.equal(plan.openOnly, false);
    assert.equal(plan.filter.status, undefined);
  });

  it('extracts a name term only from quotes / named', () => {
    const plan = planCrmSearch('find the deal named "Acme Renewal"', { organizationId: ORG });
    assert.equal(plan.entity, 'deals');
    assert.equal(plan.searchTerm, 'Acme Renewal');
    assert.ok(plan.filter.name && plan.filter.name.$regex);
    assert.match(plan.filter.name.$regex, /Acme Renewal/);
    // named lookups span all statuses
    assert.equal(plan.openOnly, false);
  });

  it('plans people search with an $or over name/email', () => {
    const plan = planCrmSearch('show me people called Jordan', { organizationId: ORG });
    assert.equal(plan.entity, 'people');
    assert.equal(plan.searchTerm, 'Jordan');
    assert.ok(Array.isArray(plan.filter.$or));
    assert.equal(plan.filter.deletedAt, null);
  });

  it('always scopes to org + excludes trash', () => {
    const plan = planCrmSearch('list open cases', { organizationId: ORG });
    assert.equal(plan.entity, 'cases');
    assert.equal(plan.filter.deletedAt, null);
    assert.ok(plan.filter.organizationId);
  });

  it('routes overdue tasks instead of defaulting to open deals', () => {
    const plan = planCrmSearch('give me the list of task which are overdue', { organizationId: ORG });
    assert.equal(plan.entity, 'tasks');
    assert.equal(plan.overdueOnly, true);
    assert.ok(plan.filter.dueDate?.$lt);
    assert.deepEqual(plan.filter.status, { $nin: ['completed', 'cancelled', 'done'] });
    assert.equal(plan.filter.name, undefined);
  });

  it('routes events today instead of defaulting to open deals', () => {
    const plan = planCrmSearch('give me the list of events today', { organizationId: ORG });
    assert.equal(plan.entity, 'events');
    assert.ok(plan.filter.startDateTime?.$gte);
    assert.ok(plan.filter.startDateTime?.$lte);
  });

  it('routes organizations / quotes / items / documents (no deals fallback)', () => {
    assert.equal(planCrmSearch('list organizations', { organizationId: ORG }).entity, 'organizations');
    assert.equal(planCrmSearch('list organizations', { organizationId: ORG }).filter.isTenant, false);
    assert.equal(planCrmSearch('show my quotes', { organizationId: ORG }).entity, 'quotes');
    assert.equal(planCrmSearch('list products', { organizationId: ORG }).entity, 'items');
    assert.equal(planCrmSearch('list documents', { organizationId: ORG }).entity, 'documents');
    assert.equal(planCrmSearch('list campaigns', { organizationId: ORG }).entity, 'campaigns');
  });

  it('marks unsupported modules without falling back to deals data', () => {
    const plan = planCrmSearch('list inventory', { organizationId: ORG });
    assert.equal(plan.entity, 'inventory');
    assert.equal(plan.unsupported, true);
  });

  it('extracts org name from "status of … Organization" and does not scope by organizationId', () => {
    const plan = planCrmSearch('Whats the status of Vtiger CRM Organization', { organizationId: ORG });
    assert.equal(plan.entity, 'organizations');
    assert.equal(plan.searchTerm, 'Vtiger CRM');
    assert.equal(plan.filter.organizationId, undefined);
    assert.equal(plan.filter.isTenant, false);
  });
});

describe('astra v2 — golden intents', () => {
  beforeEach(() => bootstrap.resetForTests());

  it('passes the full golden set (incl. list open deals)', () => {
    const report = runGoldenSet({ organizationId: ORG });
    const failing = report.cases.filter((c) => !c.passed);
    assert.deepEqual(
      failing.map((c) => ({ q: c.query, f: c.failures })),
      [],
      'no golden intent regressions',
    );
    assert.equal(report.passed, report.total);
  });

  it('classifies list-open-deals as crm_search', () => {
    assert.equal(classifyIntent('list all open deals', {}), 'crm_search');
  });

  it('classifies date small-talk as chitchat, not open deals', () => {
    assert.equal(classifyIntent('What is the date today?', {}), 'chitchat');
  });

  it('classifies draft-email as email_draft, not open deals', () => {
    assert.equal(classifyIntent('Now draft an email saying lets catchup', {}), 'email_draft');
    assert.equal(classifyIntent('draft an email to Ada', {}), 'email_draft');
  });

  it('classifies task/calendar creates and unknown as clarify', () => {
    assert.equal(classifyIntent('create a task to call Ada', {}), 'task_create');
    assert.equal(classifyIntent('book a meeting with Ada', {}), 'calendar_create');
    assert.equal(classifyIntent('Create a event for vtiger CRM org for tomorrow at 10:00AM', {}), 'calendar_create');
    assert.equal(classifyIntent('create an event for Acme', {}), 'calendar_create');
    assert.equal(classifyIntent('Help me prepare for these events now', {}), 'meeting_prep');
    assert.equal(classifyIntent('give me the list of events today', {}), 'crm_search');
    assert.equal(classifyIntent('asdf qwer zxcv', {}), 'clarify');
  });
});

describe('astra v2 — LLM intent boost', () => {
  it('parses LLM intent JSON from allow-list', () => {
    const { parseLlmIntentJson, mergeIntent } = require('../../orchestrator/intentLlmClassify');
    const { classifyIntentDetailed } = require('../../orchestrator/intentRegistry');
    const parsed = parseLlmIntentJson('{"intent":"calendar_create","confidence":0.91,"title":"Vtiger CRM"}');
    assert.equal(parsed.intent, 'calendar_create');
    assert.equal(parsed.title, 'Vtiger CRM');
    const heuristic = classifyIntentDetailed('list events today', {});
    const merged = mergeIntent(heuristic, parsed, 'Create a event for Acme');
    assert.equal(merged.intent, 'calendar_create');
    assert.equal(merged.reason, 'llm_primary');
  });

  it('mergeIntent: heuristic is fallback-only when LLM is null', () => {
    const { mergeIntent } = require('../../orchestrator/intentLlmClassify');
    const { classifyIntentDetailed } = require('../../orchestrator/intentRegistry');
    const heuristic = classifyIntentDetailed('create a task to call Ada', {});
    const merged = mergeIntent(heuristic, null, 'create a task to call Ada');
    assert.equal(merged.intent, 'task_create');
    assert.match(String(merged.reason || ''), /heuristic_fallback|task_create|guard/);
  });

  it('LLM classifier receives history + focus for anaphora', async () => {
    const { classifyIntentPrecise } = require('../../orchestrator/intentLlmClassify');
    let seen = null;
    const result = await classifyIntentPrecise(
      'Now help me prepare for the same meeting',
      {},
      {
        llmIntent: true,
        history: [
          { role: 'user', content: 'Create a event for Vtiger CRM org tomorrow' },
          { role: 'assistant', content: 'I can create "Vtiger CRM org". Confirm to save.' },
        ],
        focus: { kind: 'events', name: 'Vtiger CRM org', id: 'pending:Vtiger' },
        llm: async (messages) => {
          seen = messages;
          return {
            text: JSON.stringify({ intent: 'meeting_prep', confidence: 0.97 }),
            usage: {},
          };
        },
      },
    );
    assert.equal(result.intent, 'meeting_prep');
    const userBlob = String(seen?.[1]?.content || '');
    assert.match(userBlob, /FOCUS:.*events/i);
    assert.match(userBlob, /CONVERSATION_HISTORY:/i);
    assert.match(userBlob, /Vtiger/i);
  });

  it('LLM slots drive event title + 11AM (not regex dump / default 10AM)', async () => {
    const result = await runOrchestrator(
      {
        organizationId: ORG,
        query: "Create an event with Vtiger CRM organization, or it related contact at tomorrow 11AM for 30 min. regarding 'initiating a new product called - NextGen Platform with Full of AI capabilities'.",
        conversationId: 'c-llm-slots-1',
      },
      {
        audit: false,
        llmIntent: true,
        models: {
          Organization: {
            find() {
              const chain = {
                sort() { return chain; },
                limit() { return chain; },
                lean: async () => [{ _id: 'org-vtiger', name: 'Vtiger CRM' }],
              };
              return chain;
            },
            countDocuments: async () => 1,
          },
        },
        llm: intentThenPolishLlm(
          {
            intent: 'calendar_create',
            confidence: 0.97,
            title: 'NextGen Platform — Vtiger CRM',
            relatedName: 'Vtiger CRM',
            topic: 'initiating NextGen Platform with AI capabilities',
            day: 'tomorrow',
            time: '11:00',
            meridiem: 'am',
            durationMinutes: 30,
            entity: 'organizations',
          },
          'I can create "NextGen Platform — Vtiger CRM" for tomorrow at 11:00 am (30 min). Topic: initiating NextGen Platform with AI capabilities. Confirm to save the event.',
        ),
      },
    );
    assert.equal(result.intent, 'calendar_create');
    assert.equal(result.intentSource, 'llm');
    assert.match(result.answer, /NextGen Platform/i);
    assert.ok(!/or it related contact/i.test(result.answer));
    assert.match(result.answer, /11:00|11\s*am/i);
    assert.ok(!/10:00\s*am/i.test(result.answer));
    const start = result.toolResult?.payload?.startDateTime || result.proposals?.[0]?.payload?.startDateTime;
    assert.ok(start);
    assert.equal(new Date(start).getHours(), 11);
    const details = result.proposals?.[0]?.details || [];
    assert.ok(details.some((d) => d.label === 'Title' && /NextGen/i.test(d.value)));
    assert.ok(details.some((d) => d.label === 'When'));
    assert.ok(details.some((d) => d.label === 'Duration' && /30/.test(d.value)));
    assert.ok(details.some((d) => /Related|Vtiger/i.test(`${d.label} ${d.value}`)));
  });

  it('scheduleFromLlmSlots + resolveEventTitle helpers', () => {
    const { scheduleFromLlmSlots, resolveEventTitle, parseLlmIntentJson } = require('../../orchestrator/intentLlmClassify');
    const slots = parseLlmIntentJson(JSON.stringify({
      intent: 'calendar_create',
      confidence: 0.9,
      title: 'Kickoff',
      day: 'tomorrow',
      time: '11:00',
      meridiem: 'am',
      durationMinutes: 30,
    }));
    const schedule = scheduleFromLlmSlots(slots);
    assert.equal(schedule.durationMinutes, 30);
    assert.equal(new Date(schedule.startDateTime).getHours(), 11);
    assert.equal(
      resolveEventTitle({ llmTitle: 'NextGen — Vtiger' }, 'Vtiger CRM organization, or it related contact at'),
      'NextGen — Vtiger',
    );
    assert.equal(
      resolveEventTitle({}, 'Vtiger CRM organization, or it related contact at'),
      'Meeting',
    );
  });

  it('extractEventSlots builds clean title/description from messy create prompt', async () => {
    const { heuristicEventSlots, resolveEventCreateSlots, isGarbageTitle } = require('../../orchestrator/extractEventSlots');
    const q = 'Create an event with Vtiger organization or wil its related contact, regarding "Partner Implementation" tomorrow at 11 AM, for 30 min.';
    assert.equal(isGarbageTitle('Vtiger organization or wil its related contact, regarding "Partner Implementation"'), true);
    const h = heuristicEventSlots(q);
    assert.equal(h.title, 'Partner Implementation');
    assert.match(String(h.relatedName || ''), /vtiger/i);
    assert.equal(h.time, '11:00');
    assert.equal(h.meridiem, 'am');
    assert.equal(h.durationMinutes, 30);
    assert.match(String(h.description || ''), /Partner Implementation|Vtiger/i);

    const slots = await resolveEventCreateSlots({
      query: q,
      classification: {},
      llm: async () => ({
        text: JSON.stringify({
          title: 'Partner Implementation',
          description: 'Discuss Partner Implementation with Vtiger CRM and related contact.',
          relatedName: 'Vtiger CRM',
          contactName: null,
          day: 'tomorrow',
          time: '11:00',
          meridiem: 'am',
          durationMinutes: 30,
        }),
        usage: {},
      }),
    });
    assert.equal(slots.title, 'Partner Implementation');
    assert.equal(slots.source, 'llm');
    assert.ok(!/wil its related/i.test(slots.title));
  });

  it('orchestrator uses LLM intent when heuristic wrongly picks crm_search', async () => {
    const result = await runOrchestrator(
      {
        organizationId: ORG,
        query: 'Create a event for vtiger CRM org for tomorrow at 10:00AM for 30 mins',
        conversationId: 'c-evt-create-1',
      },
      {
        audit: false,
        llmIntent: true,
        llm: intentThenPolishLlm(
          {
            intent: 'calendar_create',
            confidence: 0.95,
            title: 'Vtiger CRM',
          },
          'I can create "Vtiger CRM" for the requested time. Confirm to save the event.',
        ),
      },
    );
    assert.equal(result.intent, 'calendar_create');
    assert.equal(result.tool, 'calendar.createEvent');
    assert.ok(result.proposals?.length === 1);
    assert.match(result.answer, /confirm|create/i);
    assert.ok(!/you have \d+ events/i.test(result.answer));
  });

  it('LLM-primary: prepare for events → meeting_prep tool path', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'Help me prepare for these events now' },
      {
        audit: false,
        llmIntent: true,
        models: {
          Event: {
            find() {
              const chain = {
                sort() { return chain; },
                limit() { return chain; },
                lean: async () => [
                  { _id: 'e1', title: 'Standup', status: 'Planned', startDateTime: new Date() },
                ],
              };
              return chain;
            },
            countDocuments: async () => 1,
          },
        },
        llm: intentThenPolishLlm(
          { intent: 'meeting_prep', confidence: 0.96 },
          "You've got 1 event to prep for — starting with Standup.\n\nPrep checklist:\n1. Open each event and confirm attendees + agenda.\n2. Skim related deals/org notes for talking points.\n3. Draft a short reminder or follow-up email if needed.\n4. Add a prep task if anything is still open.",
        ),
      },
    );
    assert.equal(result.intent, 'meeting_prep');
    assert.equal(result.tool, 'search.crm');
    assert.match(result.answer, /prep|checklist|event/i);
  });

  it('prepare for the same meeting uses calendar_create focus, not today list', async () => {
    const sessionMemory = require('../../memory/sessionMemory');
    sessionMemory.resetForTests();
    const cid = 'c-same-meeting-1';
    const otherEvents = [
      { _id: 'e-other-1', title: 'ReportsE2E Event A', status: 'Planned', startDateTime: new Date() },
      { _id: 'e-other-2', title: 'ReportsE2E Event B', status: 'Planned', startDateTime: new Date() },
      { _id: 'e-focus', title: 'Vtiger CRM org event', status: 'Planned', startDateTime: new Date() },
    ];
    const eventModel = {
      find() {
        const chain = {
          sort() { return chain; },
          limit() { return chain; },
          lean: async () => otherEvents,
        };
        return chain;
      },
      countDocuments: async () => otherEvents.length,
    };

    const created = await runOrchestrator(
      {
        organizationId: ORG,
        query: 'Create a event for vtiger CRM org for tomorrow at 10:00AM for 30 mins',
        conversationId: cid,
      },
      {
        audit: false,
        llmIntent: false,
        models: { Event: eventModel },
      },
    );
    assert.equal(created.intent, 'calendar_create');
    const focus = sessionMemory.getFocus(ORG, cid);
    assert.equal(focus?.kind, 'events');
    assert.match(String(focus?.name || ''), /vtiger/i);

    const prep = await runOrchestrator(
      {
        organizationId: ORG,
        query: 'Now help me prepare for the same meeting',
        conversationId: cid,
      },
      {
        audit: false,
        llmIntent: false,
        models: { Event: eventModel },
      },
    );
    assert.equal(prep.intent, 'meeting_prep');
    assert.match(prep.answer, /Vtiger CRM org event|Let's prep for/i);
    assert.ok(!/ReportsE2E/i.test(prep.answer));
    assert.equal(prep.toolResult?.hits?.length, 1);
  });
});

describe('astra v2 — workforce seats + writes', () => {
  beforeEach(() => bootstrap.resetForTests());

  it('returns agentKey and confirm proposal for task_create', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'create a task to call the sponsor', conversationId: 'c-task-1' },
      { audit: false, llmIntent: false, llm: async () => ({ text: '', usage: {} }) },
    );
    assert.equal(result.intent, 'task_create');
    assert.equal(result.agentKey, 'mission-control');
    assert.equal(result.tool, 'crm.tasks.create');
    assert.ok(result.proposals?.length === 1);
    assert.equal(result.proposals[0].toolName, 'crm.tasks.create');
    assert.match(result.proposals[0].payload.title, /call the sponsor/i);
  });

  it('record_update proposes module.update when focus has recordId', async () => {
    const result = await runOrchestrator(
      {
        organizationId: ORG,
        query: 'make this event as completed',
        conversationId: 'c-upd-1',
        focus: {
          kind: 'events',
          moduleKey: 'events',
          id: 'evt-1',
          recordId: 'evt-1',
          name: 'July 19th deal Followup',
        },
      },
      { audit: false, llmIntent: false, llm: async () => ({ text: '', usage: {} }) },
    );
    assert.equal(result.intent, 'record_update');
    assert.equal(result.tool, 'module.update');
    assert.ok(result.proposals?.length === 1);
    assert.equal(result.proposals[0].toolName, 'module.update');
    assert.equal(result.proposals[0].payload.moduleKey, 'events');
    assert.equal(result.proposals[0].payload.recordId, 'evt-1');
    assert.equal(result.proposals[0].payload.fields.status, 'Completed');
  });

  it('record_update resolves recordId from title via module.search', async () => {
    const Event = mockModel([
      { _id: 'evt-19', eventName: 'July 19th deal Followup', status: 'Planned' },
    ]);
    const result = await runOrchestrator(
      {
        organizationId: ORG,
        query: 'The title of the event is : July 19th deal Followup make this event as completed',
        conversationId: 'c-upd-2',
      },
      {
        audit: false,
        llmIntent: false,
        llm: async () => ({ text: '', usage: {} }),
        models: { Event },
      },
    );
    assert.equal(result.intent, 'record_update');
    assert.equal(result.tool, 'module.update');
    assert.ok(result.proposals?.length === 1);
    assert.equal(result.proposals[0].payload.recordId, 'evt-19');
    assert.equal(result.proposals[0].payload.fields.status, 'Completed');
  });

  it('module.update applies fields only after confirmed:true', async () => {
    bootstrap.resetForTests();
    bootstrap.ensureBootstrapped();
    let updated = null;
    const Event = {
      schema: { paths: { deletedAt: true, organizationId: true } },
      findOneAndUpdate(filter, update) {
        updated = { filter, update };
        const doc = {
          _id: filter._id,
          eventName: 'July 19th deal Followup',
          status: update.$set.status,
        };
        return { lean: async () => doc };
      },
    };
    const tool = toolRegistry.getTool('module.update');
    const pending = await tool.run(
      { moduleKey: 'events', recordId: 'evt-19', fields: { status: 'Completed' } },
      { organizationId: ORG, deps: { models: { Event } } },
    );
    assert.equal(pending.type, 'confirm_action');
    assert.equal(updated, null);

    const applied = await tool.run(
      {
        moduleKey: 'events',
        recordId: 'evt-19',
        fields: { status: 'Completed' },
        confirmed: true,
      },
      { organizationId: ORG, deps: { models: { Event } } },
    );
    assert.equal(applied.ok, true);
    assert.equal(updated.update.$set.status, 'Completed');
  });

  it('returns calendar create proposal for book a meeting', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'book a meeting with Ada', conversationId: 'c-cal-1' },
      { audit: false, llmIntent: false },
    );
    assert.equal(result.intent, 'calendar_create');
    assert.equal(result.agentKey, 'mission-control');
    assert.equal(result.tool, 'calendar.createEvent');
    assert.ok(result.proposals?.length === 1);
    const prop = result.proposals[0];
    assert.match(String(prop.label || ''), /Create (event|meeting)|"/i);
    assert.ok(Array.isArray(prop.details) && prop.details.length >= 2);
    const labels = prop.details.map((d) => d.label);
    assert.ok(labels.includes('Title'));
    assert.ok(labels.includes('When') || labels.includes('Duration'));
    assert.ok(prop.details.every((d) => d.label && d.value));
  });

  it('calendar.createEvent persists via Event.create on confirm', async () => {
    bootstrap.resetForTests();
    bootstrap.ensureBootstrapped();
    const created = [];
    const Event = {
      create: async (doc) => {
        created.push(doc);
        return { _id: 'evt-real-1', eventName: doc.eventName };
      },
    };
    const tool = toolRegistry.getTool('calendar.createEvent');
    const result = await tool.run(
      {
        title: 'Vtiger CRM org event',
        startDateTime: new Date(Date.now() + 86400000).toISOString(),
        endDateTime: new Date(Date.now() + 86400000 + 1800000).toISOString(),
        confirmed: true,
      },
      {
        organizationId: ORG,
        userId: '507f1f77bcf86cd799439022',
        deps: { models: { Event } },
      },
    );
    assert.equal(result.created, true);
    assert.equal(result.id, 'evt-real-1');
    assert.equal(created.length, 1);
    assert.equal(created[0].eventName, 'Vtiger CRM org event');
    assert.equal(created[0].eventType, 'Meeting');
    assert.ok(created[0].assignedTo);
    assert.ok(created[0].startDateTime);
    assert.ok(created[0].endDateTime);
  });

  it('calendar.createEvent does not fake success without user context', async () => {
    bootstrap.resetForTests();
    bootstrap.ensureBootstrapped();
    const tool = toolRegistry.getTool('calendar.createEvent');
    const result = await tool.run(
      { title: 'Ghost event', confirmed: true },
      { organizationId: ORG, userId: null, deps: { models: { Event: { create: async () => ({}) } } } },
    );
    assert.equal(result.created, false);
    assert.equal(result.error, 'EVENT_CONTEXT_REQUIRED');
  });

  it('calendar.createEvent warns on time conflict and duplicate', async () => {
    bootstrap.resetForTests();
    bootstrap.ensureBootstrapped();
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(11, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const existing = [{
      _id: 'evt-existing-1',
      eventName: 'Standup Sync',
      eventType: 'Meeting',
      status: 'Planned',
      startDateTime: start,
      endDateTime: end,
    }];
    const Event = {
      find() {
        const chain = {
          sort() { return chain; },
          limit() { return chain; },
          lean: async () => existing,
        };
        return chain;
      },
      create: async () => {
        throw new Error('should not create on proposal');
      },
    };
    const tool = toolRegistry.getTool('calendar.createEvent');
    const result = await tool.run(
      {
        title: 'Standup Sync',
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      },
      {
        organizationId: ORG,
        userId: '507f1f77bcf86cd799439022',
        deps: { models: { Event } },
      },
    );
    assert.equal(result.type, 'confirm_action');
    assert.equal(result.scheduleWarning, true);
    assert.ok(result.conflicts.length >= 1);
    assert.ok(result.duplicates.length >= 1);
    assert.equal(result.payload.override, true);
    assert.match(result.summary, /override/i);
    assert.match(String(result.guidance || ''), /already have|duplicate/i);
  });

  it('calendar.createEvent allows override create despite conflict', async () => {
    bootstrap.resetForTests();
    bootstrap.ensureBootstrapped();
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(11, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const existing = [{
      _id: 'evt-existing-2',
      eventName: 'Standup Sync',
      eventType: 'Meeting',
      status: 'Planned',
      startDateTime: start,
      endDateTime: end,
    }];
    const created = [];
    const Event = {
      find() {
        const chain = {
          sort() { return chain; },
          limit() { return chain; },
          lean: async () => existing,
        };
        return chain;
      },
      create: async (doc) => {
        created.push(doc);
        return { _id: 'evt-override-1', eventName: doc.eventName };
      },
    };
    const tool = toolRegistry.getTool('calendar.createEvent');
    const blocked = await tool.run(
      {
        title: 'Standup Sync',
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        confirmed: true,
        override: false,
      },
      {
        organizationId: ORG,
        userId: '507f1f77bcf86cd799439022',
        deps: { models: { Event } },
      },
    );
    assert.equal(blocked.created, false);
    assert.equal(blocked.error, 'EVENT_SCHEDULE_CONFLICT');

    const ok = await tool.run(
      {
        title: 'Standup Sync',
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        confirmed: true,
        override: true,
      },
      {
        organizationId: ORG,
        userId: '507f1f77bcf86cd799439022',
        deps: { models: { Event } },
      },
    );
    assert.equal(ok.created, true);
    assert.equal(ok.overridden, true);
    assert.equal(created.length, 1);
  });

  it('task create warns on duplicate open tasks', async () => {
    bootstrap.resetForTests();
    bootstrap.ensureBootstrapped();
    const existing = [{
      _id: 'task-1',
      title: 'Call the sponsor',
      status: 'todo',
      priority: 'medium',
    }];
    const Task = {
      find() {
        const chain = {
          sort() { return chain; },
          limit() { return chain; },
          lean: async () => existing,
        };
        return chain;
      },
      create: async () => {
        throw new Error('should not create on proposal');
      },
    };
    const tool = toolRegistry.getTool('crm.tasks.create');
    const result = await tool.run(
      { title: 'Call the sponsor' },
      {
        organizationId: ORG,
        userId: '507f1f77bcf86cd799439022',
        deps: { models: { Task } },
      },
    );
    assert.equal(result.type, 'confirm_action');
    assert.equal(result.createWarning, true);
    assert.ok(result.duplicates.length >= 1);
    assert.equal(result.payload.override, true);
    assert.match(result.summary, /override/i);
  });

  it('deal create warns on duplicate names', async () => {
    bootstrap.resetForTests();
    bootstrap.ensureBootstrapped();
    const Deal = {
      find() {
        const chain = {
          sort() { return chain; },
          limit() { return chain; },
          lean: async () => [{ _id: 'd1', name: 'Acme Renewal', status: 'Open' }],
        };
        return chain;
      },
    };
    const tool = toolRegistry.getTool('crm.deals.create');
    const result = await tool.run(
      { name: 'Acme Renewal' },
      { organizationId: ORG, userId: '507f1f77bcf86cd799439022', deps: { models: { Deal } } },
    );
    assert.equal(result.createWarning, true);
    assert.ok(result.duplicates.length >= 1);
  });

  it('clarifies unknown queries instead of open deals', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'do something cool' },
      { audit: false, llmIntent: false, ...dealsDeps([{ _id: 'd1', name: 'Should Not Appear', status: 'Open' }]) },
    );
    assert.equal(result.intent, 'clarify');
    assert.equal(result.agentKey, 'mission-control');
    assert.ok(!/Should Not Appear/i.test(result.answer));
    assert.ok(result.blocks.some((b) => b.type === 'clarify'));
  });

  it('honors request.agent when registered', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'list all open deals', agent: 'deal-intelligence' },
      { audit: false, ...dealsDeps([{ _id: 'd1', name: 'Acme', status: 'Open', amount: 1 }]), llm: async () => ({ text: '', usage: {} }) },
    );
    assert.equal(result.agentKey, 'deal-intelligence');
    assert.equal(result.intent, 'crm_search');
  });

  it('stores conversation focus from a single named hit', async () => {
    const sessionMemory = require('../../memory/sessionMemory');
    sessionMemory.resetForTests();
    const rows = [{ _id: 'd9', name: 'Focus Deal', stage: 'Proposal', status: 'Open', amount: 100 }];
    await runOrchestrator(
      { organizationId: ORG, query: 'find the deal named "Focus Deal"', conversationId: 'c-focus-1' },
      { audit: false, ...dealsDeps(rows), llm: async () => ({ text: '', usage: {} }) },
    );
    const focus = sessionMemory.getFocus(ORG, 'c-focus-1');
    assert.ok(focus);
    assert.equal(focus.name, 'Focus Deal');
    assert.equal(focus.kind, 'deals');
  });
});

describe('astra v2 — phase B workforce', () => {
  beforeEach(() => bootstrap.resetForTests());

  it('registers specialist seats and new tools', () => {
    bootstrap.ensureBootstrapped();
    assert.ok(agentRegistry.hasAgent('mission-control'));
    assert.ok(agentRegistry.hasAgent('summary'));
    assert.ok(agentRegistry.hasAgent('deal-intelligence'));
    assert.ok(agentRegistry.hasAgent('email'));
    assert.ok(agentRegistry.hasAgent('case-intelligence'));
    assert.ok(agentRegistry.hasAgent('record-creation'));
    assert.ok(agentRegistry.hasAgent('workday-orchestrator'));
    assert.ok(toolRegistry.hasTool('crm.record.get'));
    assert.ok(toolRegistry.hasTool('relationships.context'));
    assert.ok(toolRegistry.hasTool('crm.deals.update'));
    assert.ok(toolRegistry.hasTool('crm.cases.create'));
    assert.ok(toolRegistry.hasTool('quotes.draft'));
    assert.ok(toolRegistry.hasTool('playbook.run'));
    assert.ok(toolRegistry.hasTool('reviewer.critique_write'));
  });

  it('routes open deals via Mission Control', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'list all open deals' },
      { audit: false, ...dealsDeps([{ _id: 'd1', name: 'Acme', status: 'Open', amount: 1 }]), llm: async () => ({ text: '', usage: {} }) },
    );
    assert.equal(result.intent, 'crm_search');
    assert.equal(result.agentKey, 'mission-control');
  });

  it('creates case confirm proposal', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'create a case about billing error' },
      { audit: false, llmIntent: false },
    );
    assert.equal(result.intent, 'case_create');
    assert.equal(result.agentKey, 'mission-control');
    assert.equal(result.proposals[0].toolName, 'crm.cases.create');
    assert.match(result.proposals[0].payload.title, /billing error/i);
  });

  it('runs thin qualify-research-outreach playbook with seat attribution', async () => {
    function mockPeople(rows) {
      return {
        find() {
          const chain = {
            sort() { return chain; },
            limit() { return chain; },
            lean: async () => rows,
          };
          return chain;
        },
        countDocuments: async () => rows.length,
        findOne() {
          const chain = {
            lean: async () => rows[0] || null,
          };
          return chain;
        },
      };
    }
    const people = [{ _id: 'p1', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@ex.com' }];
    const result = await runOrchestrator(
      {
        organizationId: ORG,
        query: 'qualify this lead named "Ada Lovelace"',
        conversationId: 'c-pb-1',
      },
      {
        audit: false,
        llmIntent: false,
        models: { People: mockPeople(people), Deal: mockModel([]) },
        llm: async () => ({ text: '', usage: {} }),
      },
    );
    assert.equal(result.intent, 'playbook');
    assert.equal(result.playbookKey, 'qualify-research-outreach');
    assert.ok(Array.isArray(result.seats));
    assert.ok(result.seats.some((s) => s.agentKey === 'sales-qualification'));
    assert.ok(Array.isArray(result.seats) && result.seats.length >= 1);
    assert.ok(result.seats.some((s) => s.agentKey === 'reviewer'));
    assert.ok(result.proposals?.length >= 1);
  });

  it('crm.record.get loads a deal by id', async () => {
    bootstrap.ensureBootstrapped();
    const tool = toolRegistry.getTool('crm.record.get');
    const Deal = {
      findOne() {
        const chain = {
          lean: async () => ({ _id: 'd1', name: 'Acme Renewal', stage: 'Proposal', status: 'Open' }),
        };
        return chain;
      },
    };
    const result = await tool.run(
      { moduleKey: 'deals', recordId: 'd1' },
      { organizationId: ORG, deps: { models: { Deal } } },
    );
    assert.equal(result.ok, true);
    assert.equal(result.record.title, 'Acme Renewal');
  });

  it('reviewer flags email send without recipient', async () => {
    bootstrap.ensureBootstrapped();
    const tool = toolRegistry.getTool('reviewer.critique_write');
    const result = await tool.run({ toolName: 'email.send', payload: { to: '', subject: 'Hi' }, summary: 'Send' });
    assert.ok(result.issues.length >= 1);
    assert.match(result.verdict, /Recipient|flags/i);
  });
});

describe('astra v2 — phase C workforce', () => {
  beforeEach(() => bootstrap.resetForTests());

  it('passes OOTB module × agent coverage CI', () => {
    const { checkModuleCoverage } = require('../moduleCoverage');
    const report = checkModuleCoverage();
    assert.deepEqual(report.missingTools, [], 'every module maps to a tool');
    assert.deepEqual(report.missingAgents, [], 'every app has required seats');
    assert.ok(report.agents >= 20, 'Platform default seat catalog registered');
    assert.ok(report.tools >= 25, 'expanded tool surface');
  });

  it('registers agent.handoff and phase-C app tools', () => {
    bootstrap.ensureBootstrapped();
    assert.ok(toolRegistry.hasTool('agent.handoff'));
    assert.ok(toolRegistry.hasTool('campaigns.search'));
    assert.ok(toolRegistry.hasTool('inventory.stock.get'));
    assert.ok(toolRegistry.hasTool('liveChat.suggestReply'));
    assert.ok(toolRegistry.hasTool('mailroom.classify'));
    assert.ok(toolRegistry.hasTool('documents.search'));
    assert.ok(toolRegistry.hasTool('analytics.query'));
    assert.ok(agentRegistry.hasAgent('mission-control'));
    assert.ok(agentRegistry.hasAgent('email'));
    assert.ok(agentRegistry.hasAgent('conversation-intelligence'));
    assert.ok(agentRegistry.hasAgent('search'));
    assert.ok(agentRegistry.hasAgent('integration-intelligence'));
  });

  it('runs canonical qualify-enrich-propose-task-review with handoffs', async () => {
    function mockPeople(rows) {
      return {
        find() {
          const chain = {
            sort() { return chain; },
            limit() { return chain; },
            lean: async () => rows,
          };
          return chain;
        },
        countDocuments: async () => rows.length,
        findOne() {
          return { lean: async () => rows[0] || null };
        },
      };
    }
    const result = await runOrchestrator(
      {
        organizationId: ORG,
        query: 'run the canonical playbook for lead named "Ada"',
        conversationId: 'c-canon-1',
      },
      {
        audit: false,
        llmIntent: false,
        models: {
          People: mockPeople([{ _id: 'p1', first_name: 'Ada', last_name: 'L', email: 'a@ex.com' }]),
          Deal: mockModel([]),
        },
        llm: async () => ({ text: '', usage: {} }),
      },
    );
    assert.equal(result.intent, 'playbook');
    assert.equal(result.playbookKey, 'qualify-enrich-propose-task-review');
    const keys = result.seats.map((s) => s.agentKey);
    assert.ok(keys.includes('sales-qualification'));
    assert.ok(keys.includes('research'));
    assert.ok(keys.includes('proposal'));
    assert.ok(keys.includes('workflow'));
    assert.ok(keys.includes('reviewer'));
    assert.ok(Array.isArray(result.toolResult?.scratchpad?.handoffs) || result.toolResult?.seats);
    assert.ok(result.proposals?.length >= 1);
  });

  it('mailroom.classify routes support mail to helpdesk', async () => {
    bootstrap.ensureBootstrapped();
    const tool = toolRegistry.getTool('mailroom.classify');
    const result = await tool.run({ subject: 'Need help with a support issue' });
    assert.equal(result.route, 'helpdesk');
  });

  it('agent.handoff records packet', async () => {
    bootstrap.ensureBootstrapped();
    const tool = toolRegistry.getTool('agent.handoff');
    const result = await tool.run({
      fromAgent: 'research',
      toAgent: 'proposal',
      focus: { kind: 'people', id: 'p1', name: 'Ada' },
      findings: { note: 'ready' },
    }, { organizationId: ORG });
    assert.equal(result.from, 'research');
    assert.equal(result.to, 'proposal');
    assert.equal(result.packet.focus.name, 'Ada');
  });
});

describe('astra v2 — email draft turn', () => {
  it('drafts a catch-up email using conversation focus', async () => {
    const { buildEmailDraftTurn } = require('../../experience/buildEmailDraftTurn');
    const turn = await buildEmailDraftTurn({
      query: 'Now draft an email saying lets catchup',
      history: [{
        role: 'assistant',
        content: 'The strongest near-term focus is ReportsE2E Deal MR54T40F-10 ($86,699, Proposal).',
      }],
    });
    assert.match(turn.answer, /catch-up|catch up|ReportsE2E/i);
    assert.equal(turn.proposals.length, 1);
    assert.equal(turn.proposals[0].kind, 'email.send');
    assert.match(turn.draft.subject, /ReportsE2E|catch/i);
    assert.match(turn.draft.body, /catch/i);
  });
});

describe('astra v2 — record status brief', () => {
  it('detects status questions', () => {
    const { wantsRecordBrief } = require('../../experience/buildRecordStatusBrief');
    assert.equal(wantsRecordBrief('Whats the status of Vtiger CRM Organization'), true);
    assert.equal(wantsRecordBrief('list open deals'), false);
  });

  it('builds an org status brief with related metrics', async () => {
    const { buildRecordStatusBrief } = require('../../experience/buildRecordStatusBrief');
    const orgId = '507f1f77bcf86cd799439011';
    const crmOrgId = '507f1f77bcf86cd799439099';

    function mockModel(rows) {
      return {
        find() {
          const chain = {
            sort() { return chain; },
            limit() { return chain; },
            lean: async () => rows,
            select() { return chain; },
          };
          return chain;
        },
        findOne() {
          const chain = {
            select() { return chain; },
            lean: async () => rows[0] || null,
          };
          return chain;
        },
        countDocuments: async () => rows.length,
      };
    }

    const brief = await buildRecordStatusBrief({
      entity: 'organizations',
      hit: { id: crmOrgId, title: 'Vtiger CRM' },
      organizationId: orgId,
      deps: {
        models: {
          Organization: mockModel([{
            _id: crmOrgId,
            name: 'Vtiger CRM',
            derivedStatus: 'Active',
            industry: 'Software',
          }]),
          Deal: mockModel([
            { _id: 'd1', name: 'Renewal', stage: 'Negotiation', status: 'Open', amount: 12000 },
          ]),
          Case: mockModel([]),
          People: mockModel([{ _id: 'p1', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@ex.com' }]),
          Task: mockModel([{ _id: 't1', title: 'Call sponsor', status: 'todo', priority: 'high' }]),
        },
      },
    });

    assert.ok(brief);
    assert.match(brief.lead, /Vtiger CRM/i);
    assert.match(brief.lead, /I'd suggest|near-term focus|Renewal/i);
    assert.ok(Array.isArray(brief.suggestions) && brief.suggestions.length > 0);
    assert.ok(brief.blocks.some((b) => b.type === 'metrics'));
  });

  it('coaches a quiet account instead of reading zeros', async () => {
    const { buildRecordStatusBrief } = require('../../experience/buildRecordStatusBrief');
    const orgId = '507f1f77bcf86cd799439011';
    const crmOrgId = '507f1f77bcf86cd799439088';
    function mockModel(rows) {
      return {
        find() {
          const chain = {
            sort() { return chain; },
            limit() { return chain; },
            lean: async () => rows,
            select() { return chain; },
          };
          return chain;
        },
        findOne() {
          const chain = {
            select() { return chain; },
            lean: async () => rows[0] || null,
          };
          return chain;
        },
        countDocuments: async () => rows.length,
      };
    }
    const brief = await buildRecordStatusBrief({
      entity: 'organizations',
      hit: { id: crmOrgId, title: 'Vtiger CRM' },
      organizationId: orgId,
      deps: {
        models: {
          Organization: mockModel([{ _id: crmOrgId, name: 'Vtiger CRM', industry: 'Software' }]),
          Deal: mockModel([]),
          Case: mockModel([]),
          People: mockModel([{ _id: 'p1', first_name: 'Riya', last_name: 'Shah', email: 'riya@vtiger.com' }]),
          Task: mockModel([]),
        },
      },
    });
    assert.match(brief.lead, /quiet|re-engage|Riya/i);
    assert.ok(!brief.blocks.some((b) => b.type === 'metrics'), 'no zero metric strip');
    assert.ok(brief.suggestions.some((s) => /check-in|deal/i.test(s)));
  });
});

describe('astra v2 — search.crm tool', () => {
  beforeEach(() => bootstrap.resetForTests());

  it('returns hits + counts + guidance grounded in the model', async () => {
    bootstrap.ensureBootstrapped();
    const tool = toolRegistry.getTool('search.crm');
    const rows = [
      { _id: 'd1', name: 'Acme Renewal', stage: 'Negotiation', status: 'Open', amount: 5000 },
      { _id: 'd2', name: 'Beta Expansion', stage: 'Proposal', status: 'Open', amount: 8000 },
    ];
    const result = await tool.run(
      { query: 'list open deals' },
      { organizationId: ORG, deps: { models: { Deal: mockModel(rows) } } },
    );
    assert.equal(result.entity, 'deals');
    assert.equal(result.counts.total, 2);
    assert.equal(result.hits.length, 2);
    assert.equal(result.hits[0].title, 'Acme Renewal');
    assert.ok(result.guidance.includes('open deals'));
  });
});

describe('astra v2 — grounded answer + LLM override', () => {
  beforeEach(() => bootstrap.resetForTests());

  const rows = [
    { _id: 'd1', name: 'Acme Renewal', stage: 'Negotiation', status: 'Open', amount: 5000 },
    { _id: 'd2', name: 'Beta Expansion', stage: 'Proposal', status: 'Open', amount: 8000 },
  ];

  it('builds a deterministic grounded draft from hits', () => {
    const { draft, claims, blocks, lead } = buildGroundedAnswer('crm_search', 'list open deals', {
      entity: 'deals',
      openOnly: true,
      hits: rows.map((r) => ({ id: r._id, title: r.name, subtitle: `${r.stage} · ${r.status}`, amount: r.amount })),
      counts: { total: 2 },
    });
    assert.match(draft, /2/);
    // List asks keep names in UI record_list blocks, not the draft body
    assert.match(draft, /list|count/i);
    assert.match(lead, /2|open deals|focused/i);
    assert.ok(claims.length >= 1);
    assert.equal(claims[0].type, 'count');
    const list = blocks.find((b) => b.type === 'record_list');
    assert.ok(list);
    assert.equal(list.items[0].title, 'Acme Renewal');
  });

  it('falls back to the grounded draft when the LLM returns empty', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'list all open deals' },
      { ...dealsDeps(rows), llm: async () => ({ text: '', usage: {} }) },
    );
    assert.equal(result.intent, 'crm_search');
    assert.ok(result.claims.length >= 1);
    assert.match(result.answer, /open deals|focused|2/i);
    const list = result.blocks.find((b) => b.type === 'record_list');
    assert.ok(list?.items?.some((i) => i.title === 'Acme Renewal'));
    assert.equal(result.polishedUsed, false);
  });

  it('OVERRIDES the LLM when it drops every fact but hits exist', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'list all open deals' },
      { ...dealsDeps(rows), llm: async () => ({ text: 'Sure, happy to help!', usage: {} }) },
    );
    assert.match(result.answer, /open deals|focused|2/i);
    const list = result.blocks.find((b) => b.type === 'record_list');
    assert.ok(list?.items?.some((i) => i.title === 'Acme Renewal'));
    assert.equal(result.polishedUsed, false);
  });

  it('uses the LLM polish when it preserves the facts', async () => {
    const polished = 'You have 2 open deals ready to review.';
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'list all open deals' },
      { ...dealsDeps(rows), llm: async () => ({ text: polished, usage: { totalTokens: 20 } }) },
    );
    assert.equal(result.answer, polished);
    assert.equal(result.polishedUsed, true);
    assert.ok(result.blocks.some((b) => b.type === 'record_list'));
  });

  it('does not trim multi-paragraph LLM polish', async () => {
    const polished = [
      'You have 2 open deals ready to review.',
      '',
      'Acme Renewal looks hottest — I’d start there.',
      '',
      'I’d suggest:',
      '• Open Acme Renewal and confirm next step',
      '• Check Beta Expansion stage',
      '• Draft a follow-up for the quieter deal',
      '',
      'Want me to draft that follow-up now?',
    ].join('\n');
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'list all open deals' },
      { ...dealsDeps(rows), llm: async () => ({ text: polished, usage: {} }) },
    );
    assert.equal(result.polishedUsed, true);
    assert.equal(result.answer, polished);
    assert.match(result.answer, /Want me to draft/);
  });

  it('rejects dump-like LLM polish in favor of a contextual lead', async () => {
    const dump = [
      'Found 2 records',
      'entity=deals openOnly=true',
      '1. Acme Renewal',
      '2. Beta Expansion',
      '3. Gamma',
      '4. Delta',
    ].join('\n');
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'list all open deals' },
      { ...dealsDeps(rows), llm: async () => ({ text: dump, usage: {} }) },
    );
    assert.equal(result.polishedUsed, false);
    assert.doesNotMatch(result.answer, /entity=|Found 2 records/i);
    assert.match(result.answer, /Acme Renewal|open deals|2/i);
  });

  it('answers honestly when there are no hits', async () => {
    const result = await runOrchestrator(
      { organizationId: ORG, query: 'list all open deals' },
      { ...dealsDeps([]), llm: async () => ({ text: '', usage: {} }) },
    );
    assert.match(result.answer, /couldn't find|no/i);
    assert.ok(result.blocks.some((b) => b.type === 'empty'));
  });
});

describe('astra v2 — workflow agent', () => {
  beforeEach(() => bootstrap.resetForTests());

  it('runs an ordered tool workflow', async () => {
    bootstrap.ensureBootstrapped();
    const rows = [{ _id: 'd1', name: 'Acme Renewal', status: 'Open' }];
    const wf = await runWorkflowAgent(
      {
        workflow: 'pipeline-review',
        steps: [{ tool: 'search.crm', input: { query: 'open deals' } }],
      },
      { organizationId: ORG, deps: { models: { Deal: mockModel(rows) } } },
    );
    assert.equal(wf.completed, true);
    assert.equal(wf.steps.length, 1);
    assert.equal(wf.steps[0].ok, true);
    assert.equal(wf.steps[0].result.counts.total, 1);
  });

  it('halts on a write tool until confirmed', async () => {
    bootstrap.ensureBootstrapped();
    const wf = await runWorkflowAgent(
      {
        steps: [{ tool: 'email.send', input: { to: 'a@b.com', subject: 'Hi' } }],
      },
      { organizationId: ORG, deps: {} },
    );
    assert.equal(wf.completed, false);
    assert.equal(wf.steps[0].awaitingConfirmation, true);
    assert.equal(wf.steps[0].result.type, 'confirm_action');
  });

  it('routes a stepped request through the orchestrator as a workflow', async () => {
    const rows = [{ _id: 'd1', name: 'Acme Renewal', status: 'Open' }];
    const result = await runOrchestrator(
      {
        organizationId: ORG,
        query: 'run my morning routine',
        steps: [{ tool: 'search.crm', input: { query: 'open deals' } }],
      },
      { models: { Deal: mockModel(rows) }, audit: false, llmIntent: false },
    );
    assert.equal(result.intent, 'workflow');
    assert.equal(result.workflow.completed, true);
  });
});
