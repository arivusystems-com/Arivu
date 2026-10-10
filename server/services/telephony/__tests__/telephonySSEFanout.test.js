'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');

const telephonyHub = require('../telephonySSEHub');
const fanout = require('../../realtimeClusterFanout');

const { TelephonySSEHub } = telephonyHub;

function fakeRes() {
  const writes = [];
  return {
    writes,
    write(chunk) {
      writes.push(String(chunk));
      return true;
    },
    end() {},
    on() {},
  };
}

function telephonyPayloads(res) {
  return res.writes
    .filter((line) => line.startsWith('event: telephony'))
    .map((line) => JSON.parse(line.split('data: ')[1]));
}

describe('telephony SSE redis fan-out', () => {
  const hubs = [];

  after(() => {
    for (const hub of hubs) hub.shutdown();
  });

  it('delivers locally and publishes once for a worker with no browsers', async () => {
    const hub = new TelephonySSEHub();
    hubs.push(hub);
    const published = [];
    const original = fanout.publishCluster;
    fanout.publishCluster = async (channel, envelope) => {
      published.push({ channel, envelope });
      return true;
    };
    try {
      const delivered = hub.publishToOrg('org-1', { type: 'TranscriptReady', callId: 'c1' });
      assert.equal(delivered, 0);
      assert.equal(published.length, 1);
      assert.equal(published[0].channel, fanout.CHANNELS.telephony);
      assert.equal(published[0].envelope.kind, 'org');
      assert.equal(published[0].envelope.organizationId, 'org-1');
      assert.equal(published[0].envelope.payload.type, 'TranscriptReady');
    } finally {
      fanout.publishCluster = original;
    }
  });

  it('writes one local event for call, transcript, and summary types', () => {
    const hub = new TelephonySSEHub();
    hubs.push(hub);
    const res = fakeRes();
    hub.subscribe(res, 'user-1', 'org-1');
    for (const type of ['CallEnded', 'TranscriptReady', 'SummaryReady', 'CampaignProgress']) {
      hub.publishToOrg('org-1', { type }, { fromCluster: true });
    }
    const payloads = telephonyPayloads(res);
    assert.deepEqual(payloads.map((row) => row.type), [
      'CallEnded',
      'TranscriptReady',
      'SummaryReady',
      'CampaignProgress',
    ]);
  });

  it('delivers a foreign instance event once to each local client and skips the origin echo', () => {
    const api1 = fakeRes();
    const api1OtherTab = fakeRes();
    const firstId = telephonyHub.subscribe(api1, 'user-1', 'org-fanout');
    const secondId = telephonyHub.subscribe(api1OtherTab, 'user-2', 'org-fanout');
    try {
      fanout.applyClusterMessage(fanout.CHANNELS.telephony, JSON.stringify({
        kind: 'org',
        organizationId: 'org-fanout',
        payload: { type: 'SummaryReady', callId: 'c1' },
        originInstanceId: fanout.INSTANCE_ID,
      }));
      assert.equal(telephonyPayloads(api1).length, 0);
      assert.equal(telephonyPayloads(api1OtherTab).length, 0);

      fanout.applyClusterMessage(fanout.CHANNELS.telephony, JSON.stringify({
        kind: 'org',
        organizationId: 'org-fanout',
        payload: { type: 'SummaryReady', callId: 'c1' },
        originInstanceId: 'inst_worker',
      }));
      assert.equal(telephonyPayloads(api1).length, 1);
      assert.equal(telephonyPayloads(api1OtherTab).length, 1);
      assert.equal(telephonyPayloads(api1)[0].type, 'SummaryReady');
    } finally {
      telephonyHub.unsubscribe(firstId);
      telephonyHub.unsubscribe(secondId);
    }
  });
});
