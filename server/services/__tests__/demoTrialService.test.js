'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const DemoRequest = require('../../models/DemoRequest');
const {
  issueVerificationToken,
  confirmEmailVerification,
  findDemoRequestBySetupToken,
} = require('../demoTrialService');
const { hashToken } = require('../../utils/userAuthTokens');

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test.beforeEach(async () => {
  await DemoRequest.deleteMany({});
});

async function createPendingRequest(email) {
  return DemoRequest.create({
    companyName: 'Acme',
    contactName: 'Ada Lovelace',
    email,
    phone: '+14155552671',
    status: 'pending_verification',
    source: 'website',
  });
}

test('confirmEmailVerification is idempotent for the same link', async () => {
  const demoRequest = await createPendingRequest('ada@example.com');
  const rawToken = await issueVerificationToken(demoRequest);

  const first = await confirmEmailVerification(rawToken);
  assert.equal(first.ok, true);
  assert.ok(first.setupToken);

  const second = await confirmEmailVerification(rawToken);
  assert.equal(second.ok, true);
  assert.ok(second.setupToken);

  const persisted = await DemoRequest.findById(demoRequest._id);
  assert.equal(persisted.status, 'email_verified');
  assert.equal(persisted.emailVerificationTokenHash, hashToken(rawToken));

  const setup = await findDemoRequestBySetupToken(second.setupToken);
  assert.equal(setup.ok, true);
});

test('confirmEmailVerification rejects unknown tokens', async () => {
  const result = await confirmEmailVerification('not-a-real-token');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_TOKEN');
});
