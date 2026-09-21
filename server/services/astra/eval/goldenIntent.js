'use strict';

/**
 * goldenIntent — frozen golden set for Astra workforce intent routing.
 * Any regression here should fail CI (see __tests__/astraV2.test.js).
 */

const { classifyIntent } = require('../orchestrator/intentRegistry');
const { planCrmSearch } = require('../tools/families');

/**
 * @typedef {Object} GoldenCase
 * @property {string} query
 * @property {string} intent
 * @property {string} [entity]
 * @property {boolean} [openOnly]
 * @property {boolean} [expectName]
 */

/** @type {GoldenCase[]} */
const GOLDEN_INTENTS = [
  { query: 'list all open deals', intent: 'crm_search', entity: 'deals', openOnly: true, expectName: false },
  { query: 'show me my deals', intent: 'crm_search', entity: 'deals', openOnly: true, expectName: false },
  { query: 'how many open deals do I have', intent: 'crm_search', entity: 'deals', openOnly: true, expectName: false },
  { query: 'show me won deals', intent: 'crm_search', entity: 'deals', openOnly: false, expectName: false },
  { query: 'find the deal named "Acme Renewal"', intent: 'crm_search', entity: 'deals', expectName: true },
  { query: 'list open cases', intent: 'crm_search', entity: 'cases', expectName: false },
  { query: 'show me people called Jordan', intent: 'crm_search', entity: 'people', expectName: true },
  { query: 'how do I configure a pipeline stage', intent: 'knowledge', expectName: false },
  { query: 'What is the date today?', intent: 'chitchat' },
  { query: 'Now draft an email saying lets catchup', intent: 'email_draft' },
  { query: 'draft an email to Ada', intent: 'email_draft' },
  { query: 'create a task to call the sponsor', intent: 'task_create' },
  { query: 'remind me to send the proposal', intent: 'task_create' },
  { query: 'book a meeting with Ada', intent: 'calendar_create' },
  { query: 'schedule a meeting for tomorrow', intent: 'calendar_create' },
  { query: 'Create a event for vtiger CRM org along with there related contact for tomorrow at 10:00AM for 30 mins', intent: 'calendar_create' },
  { query: 'create an event for Acme tomorrow at 2pm', intent: 'calendar_create' },
  { query: 'Help me prepare for these events now', intent: 'meeting_prep' },
  { query: 'prepare for my meetings today', intent: 'meeting_prep' },
  { query: 'give me the list of events today', intent: 'crm_search', entity: 'events', expectName: false },
  { query: 'log a call with the customer', intent: 'activity_log' },
  { query: 'give me the list of task which are overdue', intent: 'crm_search', entity: 'tasks', expectName: false },
  { query: 'Whats the status of Vtiger CRM Organization', intent: 'crm_search', entity: 'organizations', expectName: true },
  { query: 'asdf qwer zxcv', intent: 'clarify' },
  { query: 'do something cool', intent: 'clarify' },
  { query: 'qualify this lead', intent: 'playbook' },
  { query: 'qualify and research', intent: 'playbook' },
  { query: 'create a case about billing error', intent: 'case_create' },
  { query: 'mark this deal as won', intent: 'deal_update' },
  { query: 'make this event as completed', intent: 'record_update' },
  { query: 'The title of the event is : July 19th deal Followup make this event as completed', intent: 'record_update' },
  { query: 'mark this task as completed', intent: 'record_update' },
  { query: 'set priority of this case to high', intent: 'record_update' },
  { query: 'draft a quote for this deal', intent: 'quote_draft' },
  { query: 'research the company Acme', intent: 'research' },
  { query: 'qualify enrich propose', intent: 'playbook' },
  { query: 'run the canonical playbook', intent: 'playbook' },
  { query: 'triage this case', intent: 'playbook' },
];

/**
 * @param {GoldenCase} testCase
 * @param {{ organizationId?: string }} [options]
 */
function runGoldenCase(testCase, options = {}) {
  const intent = classifyIntent(testCase.query, {});
  const result = { query: testCase.query, intent, passed: intent === testCase.intent, failures: [] };
  if (intent !== testCase.intent) {
    result.failures.push(`intent expected ${testCase.intent}, got ${intent}`);
  }

  if (testCase.intent === 'crm_search') {
    const plan = planCrmSearch(testCase.query, { organizationId: options.organizationId });
    result.plan = plan;
    if (testCase.entity && plan.entity !== testCase.entity) {
      result.passed = false;
      result.failures.push(`entity expected ${testCase.entity}, got ${plan.entity}`);
    }
    if (testCase.openOnly !== undefined && plan.openOnly !== testCase.openOnly) {
      result.passed = false;
      result.failures.push(`openOnly expected ${testCase.openOnly}, got ${plan.openOnly}`);
    }
    if (testCase.expectName !== undefined) {
      const hasName = Boolean(plan.searchTerm);
      if (hasName !== testCase.expectName) {
        result.passed = false;
        result.failures.push(`expectName ${testCase.expectName}, got ${hasName}`);
      }
    }
  }

  return result;
}

function runGoldenSet(options = {}) {
  const cases = GOLDEN_INTENTS.map((c) => runGoldenCase(c, options));
  return {
    total: cases.length,
    passed: cases.filter((c) => c.passed).length,
    cases,
  };
}

module.exports = {
  GOLDEN_INTENTS,
  runGoldenCase,
  runGoldenSet,
};
