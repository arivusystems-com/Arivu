'use strict';

/**
 * QA: Related Records section — cross-module linking via RelationshipInstance
 * and lookup-field reconciliation (including updates to lookup fields).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const crypto = require('crypto');

const Organization = require('../../models/Organization');
const People = require('../../models/People');
const Deal = require('../../models/Deal');
const Case = require('../../models/Case');
const Quote = require('../../models/Quote');
const Event = require('../../models/Event');
const Task = require('../../models/Task');
const RelationshipDefinition = require('../../models/RelationshipDefinition');
const RelationshipInstance = require('../../models/RelationshipInstance');
const ModuleDefinition = require('../../models/ModuleDefinition');
const { getRecordContext } = require('../recordContextService');
const { syncDealRelationshipInstances } = require('../dealRelationshipInstanceSync');
const { createInitialSlaCycle } = require('../caseLifecycleService');

let mongoServer;

const RELATIONSHIP_DEFS = [
  {
    relationshipKey: 'people_organizations',
    source: { appKey: 'sales', moduleKey: 'people' },
    target: { appKey: 'sales', moduleKey: 'organizations' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Organization' },
      target: { showAs: 'TAB', label: 'Related Contacts' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'deal_contacts',
    source: { appKey: 'sales', moduleKey: 'deals' },
    target: { appKey: 'sales', moduleKey: 'people' },
    cardinality: 'MANY_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Contacts' },
      target: { showAs: 'TAB', label: 'Related Deals' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'deal_organizations',
    source: { appKey: 'sales', moduleKey: 'deals' },
    target: { appKey: 'sales', moduleKey: 'organizations' },
    cardinality: 'MANY_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Organizations' },
      target: { showAs: 'TAB', label: 'Related Deals' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'deal_events',
    source: { appKey: 'sales', moduleKey: 'deals' },
    target: { appKey: 'platform', moduleKey: 'events' },
    cardinality: 'MANY_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Events' },
      target: { showAs: 'TAB', label: 'Related Deal' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'case_people',
    source: { appKey: 'helpdesk', moduleKey: 'cases' },
    target: { appKey: 'sales', moduleKey: 'people' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Contact' },
      target: { showAs: 'TAB', label: 'Related Cases' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'case_organizations',
    source: { appKey: 'helpdesk', moduleKey: 'cases' },
    target: { appKey: 'sales', moduleKey: 'organizations' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Organization' },
      target: { showAs: 'TAB', label: 'Related Cases' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'quote_people',
    source: { appKey: 'platform', moduleKey: 'quotes' },
    target: { appKey: 'sales', moduleKey: 'people' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Contact' },
      target: { showAs: 'TAB', label: 'Related Quotes' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'quote_organizations',
    source: { appKey: 'platform', moduleKey: 'quotes' },
    target: { appKey: 'sales', moduleKey: 'organizations' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Organization' },
      target: { showAs: 'TAB', label: 'Related Quotes' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'quote_deals',
    source: { appKey: 'platform', moduleKey: 'quotes' },
    target: { appKey: 'sales', moduleKey: 'deals' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Deal' },
      target: { showAs: 'TAB', label: 'Related Quotes' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'quote_cases',
    source: { appKey: 'platform', moduleKey: 'quotes' },
    target: { appKey: 'helpdesk', moduleKey: 'cases' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Case' },
      target: { showAs: 'TAB', label: 'Related Quotes' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'people_events',
    source: { appKey: 'sales', moduleKey: 'people' },
    target: { appKey: 'platform', moduleKey: 'events' },
    cardinality: 'MANY_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Events' },
      target: { showAs: 'TAB', label: 'Related Contacts' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'task_deals',
    source: { appKey: 'platform', moduleKey: 'tasks' },
    target: { appKey: 'sales', moduleKey: 'deals' },
    cardinality: 'MANY_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Deal' },
      target: { showAs: 'TAB', label: 'Related Tasks' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  }
];

function recordIds(context, relationshipKey) {
  const rel = context.relationships.find((r) => r.relationshipKey === relationshipKey);
  return (rel?.records || []).map((r) => String(r.recordId)).sort();
}

async function seedTenant() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const tenant = await Organization.create({
    name: `Related Records QA ${suffix}`,
    slug: `rr-qa-${suffix}`,
    isTenant: true,
    isActive: true
  });
  const userId = new mongoose.Types.ObjectId();
  return { tenant, userId };
}

async function createSalesOrg(tenantId, userId, name) {
  return Organization.create({
    name,
    isTenant: false,
    assignedTo: userId
  });
}

async function createPerson(tenantId, userId, { firstName, organization }) {
  return People.create({
    organizationId: tenantId,
    createdBy: userId,
    assignedTo: userId,
    first_name: firstName,
    organization
  });
}

async function createDeal(tenantId, userId, name) {
  return Deal.create({
    organizationId: tenantId,
    name,
    amount: 5000,
    stage: 'Qualification',
    expectedCloseDate: new Date('2026-12-31'),
    assignedTo: userId
  });
}

async function createCase(tenantId, userId, { title, contactId, organizationRefId }) {
  const now = new Date('2026-01-01T09:00:00Z');
  return Case.create({
    organizationId: tenantId,
    caseId: `CASE-${crypto.randomUUID().slice(0, 8)}`,
    title,
    assignedTo: userId,
    contactId: contactId || null,
    organizationRefId: organizationRefId || null,
    currentSlaCycle: createInitialSlaCycle(1, now)
  });
}

async function createQuote(tenantId, userId, fields = {}) {
  return Quote.create({
    organizationId: tenantId,
    quoteNumber: `QT-${crypto.randomUUID().slice(0, 8)}`,
    assignedTo: userId,
    ...fields
  });
}

async function createTask(tenantId, userId, title) {
  return Task.create({
    organizationId: tenantId,
    title,
    assignedTo: userId,
    createdBy: userId
  });
}

async function createEvent(tenantId, userId, name) {
  return Event.create({
    organizationId: tenantId,
    eventName: name,
    eventType: 'Meeting',
    startDateTime: new Date('2026-06-01T10:00:00Z'),
    endDateTime: new Date('2026-06-01T11:00:00Z'),
    createdBy: userId,
    modifiedBy: userId,
    assignedTo: userId
  });
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await RelationshipDefinition.insertMany(RELATIONSHIP_DEFS);
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('people ↔ organizations: lookup field links and reverse lookup', async () => {
  const { tenant, userId } = await seedTenant();
  const orgA = await createSalesOrg(tenant._id, userId, 'Org A');
  const orgB = await createSalesOrg(tenant._id, userId, 'Org B');
  const person = await createPerson(tenant._id, userId, { firstName: 'Pat', organization: orgA._id });

  let personCtx = await getRecordContext(tenant._id, 'sales', 'people', person._id);
  assert.deepEqual(recordIds(personCtx, 'people_organizations'), [String(orgA._id)]);

  let orgACtx = await getRecordContext(tenant._id, 'sales', 'organizations', orgA._id);
  assert.deepEqual(recordIds(orgACtx, 'people_organizations'), [String(person._id)]);

  person.organization = orgB._id;
  await person.save();

  personCtx = await getRecordContext(tenant._id, 'sales', 'people', person._id);
  assert.deepEqual(recordIds(personCtx, 'people_organizations'), [String(orgB._id)]);

  orgACtx = await getRecordContext(tenant._id, 'sales', 'organizations', orgA._id);
  assert.deepEqual(recordIds(orgACtx, 'people_organizations'), []);

  const orgBCtx = await getRecordContext(tenant._id, 'sales', 'organizations', orgB._id);
  assert.deepEqual(recordIds(orgBCtx, 'people_organizations'), [String(person._id)]);
});

test('organizations: resolve people linked via customFields.organization', async () => {
  const { tenant, userId } = await seedTenant();
  const org = await createSalesOrg(tenant._id, userId, 'Custom Fields Org');
  const person = await People.create({
    organizationId: tenant._id,
    createdBy: userId,
    assignedTo: userId,
    first_name: 'Custom',
    last_name: 'Field',
    customFields: { organization: org._id }
  });

  const orgCtx = await getRecordContext(tenant._id, 'sales', 'organizations', org._id);
  assert.deepEqual(recordIds(orgCtx, 'people_organizations'), [String(person._id)]);
});

test('organizations: reverse lookup uses people.organization not tenant organizationId metadata', async () => {
  const { tenant, userId } = await seedTenant();
  const org = await createSalesOrg(tenant._id, userId, 'Acme');
  await ModuleDefinition.create({
    organizationId: tenant._id,
    key: 'people',
    moduleKey: 'people',
    appKey: 'sales',
    label: 'Person',
    pluralLabel: 'People',
    entityType: 'CORE',
    name: 'People',
    type: 'system',
    enabled: true,
    fields: [
      {
        key: 'organizationId',
        label: 'Organization',
        dataType: 'Lookup (Relationship)',
        lookupSettings: { targetModule: 'organizations', displayField: 'name' }
      }
    ]
  });
  const peopleIds = [];
  for (let i = 0; i < 3; i++) {
    const person = await createPerson(tenant._id, userId, {
      firstName: `Contact ${i}`,
      organization: org._id
    });
    peopleIds.push(String(person._id));
  }
  const orgCtx = await getRecordContext(tenant._id, 'sales', 'organizations', org._id);
  assert.deepEqual(recordIds(orgCtx, 'people_organizations'), peopleIds.sort());
});

test('deal ↔ event: RelationshipInstance links both directions', async () => {
  const { tenant, userId } = await seedTenant();
  const deal = await createDeal(tenant._id, userId, 'Deal With Event');
  const event = await createEvent(tenant._id, userId, 'Kickoff Meeting');

  await RelationshipInstance.create({
    organizationId: tenant._id,
    relationshipKey: 'deal_events',
    source: { appKey: 'sales', moduleKey: 'deals', recordId: deal._id },
    target: { appKey: 'platform', moduleKey: 'events', recordId: event._id },
    createdBy: userId
  });

  const dealCtx = await getRecordContext(tenant._id, 'sales', 'deals', deal._id);
  assert.deepEqual(recordIds(dealCtx, 'deal_events'), [String(event._id)]);

  const eventCtx = await getRecordContext(tenant._id, 'platform', 'events', event._id);
  assert.deepEqual(recordIds(eventCtx, 'deal_events'), [String(deal._id)]);
});

test('deal dealPeople/dealOrganizations sync updates related records when fields change', async () => {
  const { tenant, userId } = await seedTenant();
  const orgA = await createSalesOrg(tenant._id, userId, 'Deal Org A');
  const orgB = await createSalesOrg(tenant._id, userId, 'Deal Org B');
  const personA = await createPerson(tenant._id, userId, { firstName: 'Alice', organization: orgA._id });
  const personB = await createPerson(tenant._id, userId, { firstName: 'Bob', organization: orgB._id });

  const deal = await Deal.create({
    organizationId: tenant._id,
    name: 'Multi-contact Deal',
    amount: 10000,
    stage: 'Qualification',
    expectedCloseDate: new Date('2026-12-31'),
    assignedTo: userId,
    dealPeople: [{
      personId: personA._id,
      role: 'decision_maker',
      isPrimary: true,
      isActive: true
    }],
    dealOrganizations: [{
      organizationId: orgA._id,
      role: 'account',
      isPrimary: true,
      isActive: true
    }]
  });

  await syncDealRelationshipInstances({
    organizationId: tenant._id,
    dealDoc: deal,
    createdBy: userId
  });

  let dealCtx = await getRecordContext(tenant._id, 'sales', 'deals', deal._id);
  assert.deepEqual(recordIds(dealCtx, 'deal_contacts'), [String(personA._id)]);
  assert.deepEqual(recordIds(dealCtx, 'deal_organizations'), [String(orgA._id)]);

  deal.dealPeople = [{
    personId: personB._id,
    role: 'decision_maker',
    isPrimary: true,
    isActive: true
  }];
  deal.dealOrganizations = [{
    organizationId: orgB._id,
    role: 'account',
    isPrimary: true,
    isActive: true
  }];
  await deal.save();

  await syncDealRelationshipInstances({
    organizationId: tenant._id,
    dealDoc: deal,
    createdBy: userId
  });

  dealCtx = await getRecordContext(tenant._id, 'sales', 'deals', deal._id);
  assert.deepEqual(recordIds(dealCtx, 'deal_contacts'), [String(personB._id)]);
  assert.deepEqual(recordIds(dealCtx, 'deal_organizations'), [String(orgB._id)]);

  const personACtx = await getRecordContext(tenant._id, 'sales', 'people', personA._id);
  assert.deepEqual(recordIds(personACtx, 'deal_contacts'), []);

  const personBCtx = await getRecordContext(tenant._id, 'sales', 'people', personB._id);
  assert.deepEqual(recordIds(personBCtx, 'deal_contacts'), [String(deal._id)]);
});

test('cases: contactId and organizationRefId lookup links update on field change', async () => {
  const { tenant, userId } = await seedTenant();
  const orgA = await createSalesOrg(tenant._id, userId, 'Case Org A');
  const orgB = await createSalesOrg(tenant._id, userId, 'Case Org B');
  const contactA = await createPerson(tenant._id, userId, { firstName: 'CaseContactA', organization: orgA._id });
  const contactB = await createPerson(tenant._id, userId, { firstName: 'CaseContactB', organization: orgB._id });

  const supportCase = await createCase(tenant._id, userId, {
    title: 'Printer issue',
    contactId: contactA._id,
    organizationRefId: orgA._id
  });

  let caseCtx = await getRecordContext(tenant._id, 'helpdesk', 'cases', supportCase._id);
  assert.deepEqual(recordIds(caseCtx, 'case_people'), [String(contactA._id)]);
  assert.deepEqual(recordIds(caseCtx, 'case_organizations'), [String(orgA._id)]);

  let contactACtx = await getRecordContext(tenant._id, 'sales', 'people', contactA._id);
  assert.deepEqual(recordIds(contactACtx, 'case_people'), [String(supportCase._id)]);

  supportCase.contactId = contactB._id;
  supportCase.organizationRefId = orgB._id;
  await supportCase.save();

  caseCtx = await getRecordContext(tenant._id, 'helpdesk', 'cases', supportCase._id);
  assert.deepEqual(recordIds(caseCtx, 'case_people'), [String(contactB._id)]);
  assert.deepEqual(recordIds(caseCtx, 'case_organizations'), [String(orgB._id)]);

  contactACtx = await getRecordContext(tenant._id, 'sales', 'people', contactA._id);
  assert.deepEqual(recordIds(contactACtx, 'case_people'), []);

  const contactBCtx = await getRecordContext(tenant._id, 'sales', 'people', contactB._id);
  assert.deepEqual(recordIds(contactBCtx, 'case_people'), [String(supportCase._id)]);
});

test('quotes: all lookup fields resolve and update in related records', async () => {
  const { tenant, userId } = await seedTenant();
  const org = await createSalesOrg(tenant._id, userId, 'Quote Org');
  const contact = await createPerson(tenant._id, userId, { firstName: 'QuoteContact', organization: org._id });
  const deal = await createDeal(tenant._id, userId, 'Quote Deal');
  const supportCase = await createCase(tenant._id, userId, { title: 'Quote Case' });

  const quote = await createQuote(tenant._id, userId, {
    contactId: contact._id,
    organizationRefId: org._id,
    dealId: deal._id,
    caseId: supportCase._id
  });

  let quoteCtx = await getRecordContext(tenant._id, 'platform', 'quotes', quote._id);
  assert.deepEqual(recordIds(quoteCtx, 'quote_people'), [String(contact._id)]);
  assert.deepEqual(recordIds(quoteCtx, 'quote_organizations'), [String(org._id)]);
  assert.deepEqual(recordIds(quoteCtx, 'quote_deals'), [String(deal._id)]);
  assert.deepEqual(recordIds(quoteCtx, 'quote_cases'), [String(supportCase._id)]);

  const deal2 = await createDeal(tenant._id, userId, 'Quote Deal 2');
  quote.dealId = deal2._id;
  quote.contactId = null;
  await quote.save();

  quoteCtx = await getRecordContext(tenant._id, 'platform', 'quotes', quote._id);
  assert.deepEqual(recordIds(quoteCtx, 'quote_deals'), [String(deal2._id)]);
  assert.deepEqual(recordIds(quoteCtx, 'quote_people'), []);
  assert.deepEqual(recordIds(quoteCtx, 'quote_organizations'), [String(org._id)]);
  assert.deepEqual(recordIds(quoteCtx, 'quote_cases'), [String(supportCase._id)]);

  const dealCtx = await getRecordContext(tenant._id, 'sales', 'deals', deal2._id);
  assert.deepEqual(recordIds(dealCtx, 'quote_deals'), [String(quote._id)]);

  const oldDealCtx = await getRecordContext(tenant._id, 'sales', 'deals', deal._id);
  assert.deepEqual(recordIds(oldDealCtx, 'quote_deals'), []);
});

test('deal related records dedupe instance link with synced dealPeople', async () => {
  const { tenant, userId } = await seedTenant();
  const org = await createSalesOrg(tenant._id, userId, 'Dedupe Org');
  const person = await createPerson(tenant._id, userId, { firstName: 'Dedupe', organization: org._id });
  const deal = await Deal.create({
    organizationId: tenant._id,
    name: 'Dedupe Deal',
    amount: 1000,
    stage: 'Qualification',
    expectedCloseDate: new Date('2026-12-31'),
    assignedTo: userId,
    dealPeople: [{
      personId: person._id,
      role: 'decision_maker',
      isPrimary: true,
      isActive: true
    }]
  });

  await syncDealRelationshipInstances({
    organizationId: tenant._id,
    dealDoc: deal,
    createdBy: userId
  });

  await RelationshipInstance.create({
    organizationId: tenant._id,
    relationshipKey: 'deal_contacts',
    source: { appKey: 'sales', moduleKey: 'deals', recordId: deal._id },
    target: { appKey: 'sales', moduleKey: 'people', recordId: person._id },
    createdBy: userId
  });

  const dealCtx = await getRecordContext(tenant._id, 'sales', 'deals', deal._id);
  assert.equal(recordIds(dealCtx, 'deal_contacts').length, 1);
  assert.deepEqual(recordIds(dealCtx, 'deal_contacts'), [String(person._id)]);
});

test('clearing lookup fields removes related records from both sides', async () => {
  const { tenant, userId } = await seedTenant();
  const org = await createSalesOrg(tenant._id, userId, 'Clear Org');
  const person = await createPerson(tenant._id, userId, { firstName: 'Clearable', organization: org._id });

  let personCtx = await getRecordContext(tenant._id, 'sales', 'people', person._id);
  assert.deepEqual(recordIds(personCtx, 'people_organizations'), [String(org._id)]);

  person.organization = null;
  await person.save();

  personCtx = await getRecordContext(tenant._id, 'sales', 'people', person._id);
  assert.deepEqual(recordIds(personCtx, 'people_organizations'), []);

  const orgCtx = await getRecordContext(tenant._id, 'sales', 'organizations', org._id);
  assert.deepEqual(recordIds(orgCtx, 'people_organizations'), []);
});

test('people ↔ events and tasks ↔ deals: instance links survive unrelated field updates', async () => {
  const { tenant, userId } = await seedTenant();
  const person = await createPerson(tenant._id, userId, { firstName: 'EventPerson', organization: null });
  const event = await createEvent(tenant._id, userId, 'Client Meeting');
  const deal = await createDeal(tenant._id, userId, 'Task Deal');
  const task = await createTask(tenant._id, userId, 'Follow up');

  await RelationshipInstance.create([
    {
      organizationId: tenant._id,
      relationshipKey: 'people_events',
      source: { appKey: 'sales', moduleKey: 'people', recordId: person._id },
      target: { appKey: 'platform', moduleKey: 'events', recordId: event._id },
      createdBy: userId
    },
    {
      organizationId: tenant._id,
      relationshipKey: 'task_deals',
      source: { appKey: 'platform', moduleKey: 'tasks', recordId: task._id },
      target: { appKey: 'sales', moduleKey: 'deals', recordId: deal._id },
      createdBy: userId
    }
  ]);

  let personCtx = await getRecordContext(tenant._id, 'sales', 'people', person._id);
  let taskCtx = await getRecordContext(tenant._id, 'platform', 'tasks', task._id);
  assert.deepEqual(recordIds(personCtx, 'people_events'), [String(event._id)]);
  assert.deepEqual(recordIds(taskCtx, 'task_deals'), [String(deal._id)]);

  person.first_name = 'Updated Name';
  await person.save();
  task.title = 'Updated Task Title';
  task.priority = 'High';
  await task.save();

  personCtx = await getRecordContext(tenant._id, 'sales', 'people', person._id);
  taskCtx = await getRecordContext(tenant._id, 'platform', 'tasks', task._id);
  assert.deepEqual(recordIds(personCtx, 'people_events'), [String(event._id)]);

  const eventCtx = await getRecordContext(tenant._id, 'platform', 'events', event._id);
  assert.deepEqual(recordIds(eventCtx, 'people_events'), [String(person._id)]);

  assert.deepEqual(recordIds(taskCtx, 'task_deals'), [String(deal._id)]);
  const dealCtx = await getRecordContext(tenant._id, 'sales', 'deals', deal._id);
  assert.deepEqual(recordIds(dealCtx, 'task_deals'), [String(task._id)]);
});
