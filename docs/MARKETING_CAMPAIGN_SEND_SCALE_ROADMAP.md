# Marketing Campaign Send Scale — Implementation Roadmap

**Audience:** Arivu backend + frontend developers  
**Status:** **Not started** — M11 (post v1 marketing)  
**Prerequisite:** M1–M10 complete · Track 4 campaign send · AMDS policy/credits (Track 6)  
**Architecture reference:** [Architecture_Document.md](./Architecture_Document.md) · tenant isolation · auditability  
**Parent roadmap:** [MARKETING_APPLICATION_ROADMAP.md](./MARKETING_APPLICATION_ROADMAP.md)

**Product goal:** Campaign sends up to **500,000 recipients** complete without blocking the UI, without OOM, and with predictable delivery — while preserving tenant isolation, idempotency, and the Arivu ↔ AMDS separation doctrine.

**Last updated:** 2026-07-02

---

## 1. Problem statement

Track 4 (`sendCampaignBatch.js`) works for small sends but does not scale:

| Issue | Impact at 100K–500K |
|-------|---------------------|
| Synchronous send in HTTP handler | Request timeout; UI frozen |
| Sequential per-recipient loop | Merge + DB + subscription check × N |
| `mergeData: { personId }` only | CRM merge tags not hydrated at production send |
| Dynamic audience `RECIPIENT_RESOLVE_MAX` = 5,000 | Large segments cannot send |
| Static audience members embedded in one Mongo doc | Document size / load limits |
| One `Communication.create` per recipient | DB write amplification |
| One subscription DB query per email | Query amplification |

**Target:** User clicks Send → **202 immediately** → background pipeline prepares and submits to AMDS in chunks → UI shows live progress → AMDS delivers at policy throughput.

---

## 2. Separation doctrine (unchanged)

| Responsibility | Arivu | AMDS |
|----------------|----------|------|
| Recipient resolution (segments, audiences) | ✅ | — |
| CRM merge tag hydration + HTML render | ✅ (this roadmap) | Future: `template_id` |
| Unsubscribe / preference URLs | ✅ | — |
| Credit precheck + reserve (approximate) | ✅ | Authoritative debit |
| Chunk submit (`sendCampaignBatch`) | ✅ | ✅ accepts |
| SMTP, queue, retry, bounce | — | ✅ |
| Open/click tracking | — | ✅ |
| Delivery throughput / warmup | — | ✅ |

Hard rule: **No SMTP in marketing paths.** All delivery still goes through `AmdsClient.sendCampaignBatch()`.

Future AMDS `template_id` rendering (see [ARIVU-INTEGRATION.md](./ARIVU-INTEGRATION.md) §9) is **Phase F** — optional acceleration, not required for 500K.

---

## 3. Target architecture

```
POST /campaigns/:id/send
  → validate + reserve credits
  → Campaign.status = preparing
  → enqueue orchestrator job
  → 202 { jobId, phase: 'queued' }

Orchestrator (Bull/Redis)
  → Job A: resolve recipients (cursor stream → CampaignRecipient rows)
  → Job B×N: process chunk (500–1000 recipients)
       → bulk load People (+ org fields from tag scan)
       → merge HTML per recipient (mergeTagEngine)
       → bulk filter unsubscribes
       → bulkWrite Communications
       → AmdsClient.sendCampaignBatch (500/msg API chunks)
       → increment campaign.stats
  → Campaign.status = delivering → completed (prep done; AMDS still sending)

UI polls GET /campaigns/:id/send-progress
AMDS webhooks update delivery stats (existing Track 4)
```

**Memory bound:** one chunk (~500 recipients × HTML size), never full audience in RAM.

**Concurrency:** one active chunk pipeline per campaign; fair per-tenant queue limits.

---

## 4. Progress tracker

| Phase | Scope | Status | Estimate |
|-------|-------|--------|----------|
| **M11-A** — Async send shell | Queue, 202 API, campaign send state, inline fallback | ✅ Done | 1 week |
| **M11-B** — CampaignRecipient snapshot | Model, streaming resolver, remove 5K cap for sends | ✅ Done | 1–2 weeks |
| **M11-C** — Chunk worker pipeline | Bulk People hydrate, merge, bulkWrite, AMDS submit | ✅ Done | 2 weeks |
| **M11-D** — Progress + credits | Live stats API, credit reserve/release, UI progress | ✅ Done | 1 week |
| **M11-E** — Schedule freeze + resume | Snapshot at schedule time; idempotent chunk retry | ✅ Done | 1 week |
| **M11-F** — Scale hardening | Load test 500K, observability, policy limits | ✅ Done | 1–2 weeks |
| **M11-G** — AMDS template rendering | `template_id` + merge payload (AMDS API required) | ❌ Future | TBD |

**Total estimate:** 6–8 weeks (M11-A through M11-F).

---

## 5. Data model

### 5.1 `CampaignRecipient` (new)

Per-recipient send staging — replaces in-memory recipient arrays for large sends.

```javascript
{
  organizationId: ObjectId,
  campaignId: ObjectId,
  personId: ObjectId | null,
  email: String,           // lowercase, indexed
  name: String,
  recipientId: String,     // personId or email hash
  status: 'pending' | 'prepared' | 'queued' | 'rejected' | 'suppressed' | 'skipped',
  chunkIndex: Number,
  variantKey: String | null,   // A/B
  idempotencyKeyHash: String,
  mergeScopeHash: String | null,
  errorCode: String | null,
  communicationId: ObjectId | null,
  createdAt, updatedAt
}
```

**Indexes:**

- `{ organizationId, campaignId, status }`
- `{ organizationId, campaignId, email }` unique
- `{ organizationId, campaignId, chunkIndex }`

**TTL:** optional cleanup job 90 days post-send (Communications remain source of truth for engagement).

### 5.2 `Campaign` extensions

```javascript
sendState: {
  phase: 'idle' | 'resolving' | 'preparing' | 'submitting' | 'delivering' | 'completed' | 'failed',
  jobId: String | null,
  recipientSource: 'audience' | 'segment' | 'inline' | 'snapshot',
  audienceId: ObjectId | null,
  resolvedCount: Number,
  preparedCount: Number,
  lastChunkIndex: Number,
  creditsReserved: Number,
  error: String | null
},
stats: {
  // existing fields +
  prepared: Number,
  suppressed: Number,
  skippedUnsubscribed: Number
}
```

**Status enum addition:** `preparing` (between draft/scheduled and `running`).

### 5.3 Plan limits (Track 6 alignment)

Raise enterprise ceiling when M11-F ships:

| Plan | Current `maxCampaignSize` | Target |
|------|---------------------------|--------|
| BASIC | 5,000 | 5,000 |
| PRO | 25,000 | 50,000 |
| ENTERPRISE | 100,000 | 500,000 |

Credits and AMDS policy sync must match — see [ARIVU-TRACK-6-PHASE1-DRAFT.md](./ARIVU-TRACK-6-PHASE1-DRAFT.md).

---

## 6. Phase details

### M11-A — Async send shell

**Exit criteria:** Send API returns in &lt; 500ms for any audience size; campaign moves to `preparing`; job enqueued (or inline fallback when Redis absent).

**Server**

- [x] `server/services/marketing/campaignSendConstants.js` — queue name, chunk size, retry profile (mirror `importConstants.js`)
- [x] `server/services/marketing/campaignSendQueueService.js` — Bull init, enqueue, inline fallback
- [x] `server/services/marketing/campaignSendOrchestrator.js` — top-level job: validate → reserve → dispatch phases
- [x] Refactor `marketingCampaignController.sendCampaign` — enqueue orchestrator; return `202`
- [x] Refactor `marketingCampaignScheduleService.executeScheduledCampaign` — same orchestrator entry
- [x] Register worker in `server/services/scheduledJobs.js` or dedicated `campaignSendWorker.js`
- [x] Env: `ENABLE_MARKETING_CAMPAIGN_SEND_WORKER`, `MARKETING_CAMPAIGN_SEND_CHUNK_SIZE` (default 500)

**Tests**

- [x] Controller returns 202 without awaiting full batch
- [x] Inline fallback when Redis unavailable (dev/small sends)

**Do not break:** existing `sendCampaignBatch.js` — orchestrator calls it from chunk worker until M11-C refactors internals.

---

### M11-B — CampaignRecipient snapshot

**Exit criteria:** 500K segment resolves to `CampaignRecipient` rows via cursor; no single-doc 500K member array; dynamic send no longer capped at 5K.

**Server**

- [x] `server/models/CampaignRecipient.js`
- [x] `server/services/marketing/campaignRecipientSnapshotService.js`
  - Stream segment/audience → bulk insert recipients (batch 1000)
  - Dedupe by email per campaign
  - Skip invalid / no-email rows
- [x] `marketingAudienceQueryCompiler.streamPeopleForSend` — cursor/stream variant for send (not preview pagination)
- [x] Remove send-time dependency on `RECIPIENT_RESOLVE_MAX` for orchestrated sends (keep cap for UI preview sample only)
- [x] Schedule flow: snapshot recipients at `scheduleCampaignSend` (freeze audience)

**Tests**

- [x] Snapshot dedupe + send limit unit tests
- [ ] Snapshot 10K segment without loading all into memory (integration — M11-F load test)

---

### M11-C — Chunk worker pipeline

**Exit criteria:** 500-recipient chunk: bulk People load, real CRM merge hydration, bulk unsubscribe filter, bulkWrite Communications, AMDS submit — under 30s per chunk in staging.

**Server**

- [x] `server/services/marketing/campaignMergeScopeService.js`
- [x] Fix production send gap: replace bare `{ personId }` mergeData with hydrated scope
- [x] `server/services/marketing/campaignSendChunkWorker.js`
- [x] `server/services/marketing/campaignMessageBuilder.js`
- [x] `filterSubscribedRecipientsBulk` — bulk variant for chunk processing
- [x] `marketingConditionalContentService.js` — lite HubSpot `{% if %}` evaluation per recipient

**Refactor**

- [x] Split `sendCampaignBatch.js` → delegates to `processCampaignSendChunk`

**Tests**

- [x] Merge `{{People.first_name}}` resolves in production send
- [x] Bulk unsubscribe partition test
- [x] Idempotency key stable on chunk retry (covered in M11-E)

---

### M11-D — Progress + credits

**Exit criteria:** Campaign detail shows live prep progress; credits reserved at start, released on failure; precheck accurate for 500K count.

**Server**

- [x] `GET /api/marketing/campaigns/:id/send-progress` — phase, counts, estimate
- [x] `server/services/marketing/campaignSendCreditService.js` — reserve / release / reconcile with AMDS
- [x] Incremental stats updates every chunk (`prepared`, `queued`, `rejected`, `suppressed`)

**Client**

- [x] `useMarketingCampaigns.js` — `fetchCampaignSendProgress`, poll while `preparing|submitting`
- [x] `CampaignDetail.vue` — progress bar + phase label
- [x] `CampaignSendDrawer.vue` — show “Send started — track progress on campaign page” after 202

**i18n**

- [x] New keys under `marketing.campaignSendProgress*`

---

### M11-E — Schedule freeze + resume

**Exit criteria:** Scheduled campaign snapshots recipients at schedule time; worker crash mid-send resumes from last chunk without duplicate sends.

**Server**

- [x] `scheduleCampaignSend` → call snapshot service immediately (not at fire time)
- [x] Orchestrator stores `lastChunkIndex`; retry skips completed chunks
- [x] Idempotency keys unchanged: `arivu-marketing-{orgId}-{campaignId}-{recipientId}`
- [x] A/B test phases use same chunk pipeline (`marketingAbTestService.js`)

**Tests**

- [x] Resume after simulated worker failure
- [x] Scheduled send uses frozen snapshot even if segment membership changed

---

### M11-F — Scale hardening

**Exit criteria:** Staging load test 500K recipients completes prep without OOM; p95 chunk &lt; 60s; observability dashboards.

**Server**

- [x] Load test script: `server/scripts/load-test-campaign-send-scale.js`
- [x] Metrics: chunk duration, merge ms, AMDS accept rate, queue lag
- [x] Per-tenant fair queue: max concurrent campaign sends per org (env)
- [x] Update `EMAIL_POLICY_BY_PLAN.ENTERPRISE.maxCampaignSize` → 500_000
- [x] Document env tuning in this file §8

**Ops**

- [x] Redis required in production for marketing sends &gt; 5K (config guard + admin warning)
- [x] Alert on `sendState.phase = failed` or queue lag &gt; threshold

---

### M11-G — AMDS template rendering (future)

**Blocked on:** AMDS `template_id` + per-message `merge_data` API.

When available:

- Upload campaign body once as AMDS template
- Chunk worker sends merge payload only (no full HTML per message)
- Arivu orchestrator unchanged; swap render step for AMDS render

---

## 7. API changes

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/marketing/campaigns/:id/send` | Returns **202** + `{ jobId, phase, sendState } |
| `GET` | `/api/marketing/campaigns/:id/send-progress` | **New** — live prep/delivery progress |
| `POST` | `/api/marketing/campaigns/:id/schedule` | Triggers recipient snapshot |
| `GET` | `/api/marketing/campaigns/:id/precheck` | Unchanged; works with `recipientCount` up to plan max |

**Backward compatibility:** Small sends (&lt; `MARKETING_CAMPAIGN_SEND_INLINE_MAX`, default 100) may still complete inline when Redis absent (dev UX).

---

## 8. Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENABLE_MARKETING_CAMPAIGN_SEND_WORKER` | `true` | Enable Bull worker |
| `MARKETING_CAMPAIGN_SEND_QUEUE_NAME` | `marketing:campaign:send` | Bull queue name |
| `MARKETING_CAMPAIGN_SEND_CHUNK_SIZE` | `500` | Recipients per worker job |
| `MARKETING_CAMPAIGN_SEND_INLINE_MAX` | `100` | Max recipients for inline fallback |
| `MARKETING_CAMPAIGN_SEND_WORKER_CONCURRENCY` | `2` | Parallel chunk jobs (global) |
| `MARKETING_CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG` | `1` | Fairness per tenant |
| `MARKETING_CAMPAIGN_SEND_SNAPSHOT_BATCH_SIZE` | `1000` | Bulk insert batch for snapshot |
| `MARKETING_CAMPAIGN_SEND_REDIS_REQUIRED_ABOVE` | `5000` | Block prod sends above this without Redis |
| `MARKETING_CAMPAIGN_SEND_QUEUE_LAG_ALERT_MS` | `300000` | Queue lag alert threshold (5 min) |
| `MARKETING_CAMPAIGN_SEND_ALERT_INTERVAL_MS` | `300000` | Background alert poll interval |
| `MARKETING_AUDIENCE_RECIPIENT_MAX` | `5000` | **Preview UI only** after M11-B |
| `REDIS_URL` | — | Required for production scale |

**Tuning notes (M11-F staging baseline)**

- **500K snapshot prep:** `MARKETING_CAMPAIGN_SEND_SNAPSHOT_BATCH_SIZE=1000`, dedicated worker process (`ENABLE_BULL_IN_WEB=false`), Mongo wired to staging cluster with adequate IOPS.
- **Chunk worker:** keep `MARKETING_CAMPAIGN_SEND_CHUNK_SIZE=500`; raise `MARKETING_CAMPAIGN_SEND_WORKER_CONCURRENCY` only after AMDS throughput allows it (watch p95 chunk &lt; 60s).
- **Fairness:** leave `MARKETING_CAMPAIGN_SEND_MAX_CONCURRENT_PER_ORG=1` unless tenant isolation testing proves higher is safe.
- **Load test:** `node server/scripts/load-test-campaign-send-scale.js --orgId=<id> --recipients=500000 --phase=all`
- **Observability:** `GET /api/marketing/campaigns/send-metrics` exposes chunk/merge p95, AMDS accept rate, queue lag, and recent alerts.

---

## 9. File checklist

| File | Phase | Action |
|------|-------|--------|
| `server/models/CampaignRecipient.js` | B | Add |
| `server/models/Campaign.js` | A | Extend `sendState`, stats, status |
| `server/services/marketing/campaignSendConstants.js` | A | Add |
| `server/services/marketing/campaignSendQueueService.js` | A | Add |
| `server/services/marketing/campaignSendOrchestrator.js` | A | Add |
| `server/services/marketing/campaignSendChunkWorker.js` | C | Add |
| `server/services/marketing/campaignRecipientSnapshotService.js` | B | Add |
| `server/services/marketing/campaignMergeScopeService.js` | C | Add |
| `server/services/marketing/campaignSendCreditService.js` | D | Add |
| `server/services/marketing/sendCampaignBatch.js` | C | Refactor (extract chunk builder) |
| `server/services/marketing/marketingSubscriptionService.js` | C | Bulk unsubscribe filter |
| `server/controllers/marketingCampaignController.js` | A, D | 202 send + progress endpoint |
| `server/routes/marketingCampaignRoutes.js` | D | Register progress route |
| `server/services/marketing/marketingCampaignScheduleService.js` | E | Snapshot on schedule |
| `server/services/marketing/marketingAbTestService.js` | E | Use chunk pipeline |
| `server/constants/emailPolicyDefaults.js` | F | Raise enterprise max |
| `client/src/composables/useMarketingCampaigns.js` | D | Progress polling |
| `client/src/views/marketing/CampaignDetail.vue` | D | Progress UI |
| `client/src/components/marketing/CampaignSendDrawer.vue` | D | Post-202 UX |
| `client/src/locales/en/marketing.json` | D | i18n keys |
| `server/scripts/load-test-campaign-send-scale.js` | F | Add |
| `server/services/marketing/campaignSendMetrics.js` | F | Add |
| `server/services/marketing/campaignSendScaleGuard.js` | F | Add |
| `server/services/marketing/campaignSendOrgLimiter.js` | F | Add |
| `server/services/marketing/campaignSendAlertService.js` | F | Add |

---

## 10. Testing strategy

| Layer | Coverage |
|-------|----------|
| Unit | Merge scope builder, tag scan, bulk unsubscribe filter, chunk message builder |
| Integration | Snapshot → chunk → AMDS mock; idempotent retry |
| E2E | Extend `validate-amds-track4-campaign.js` with async flow |
| Load | 500K synthetic recipients in staging; monitor memory + duration |

**Success gates (M11-F):**

- Prep 500K recipients in &lt; 2 hours (staging hardware baseline)
- Peak worker memory &lt; 512MB per process
- Zero duplicate sends on chunk retry
- UI responsive throughout (202 &lt; 500ms)

---

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Redis unavailable in prod | Inline max 100; admin banner; block &gt;5K send without Redis |
| Worker crash mid-campaign | Chunk idempotency + `lastChunkIndex` resume |
| CRM data changes during send | Snapshot at send/schedule (M11-E) |
| AMDS 429 rate limit | Existing retry + backoff; pace chunk submit to `effectiveHourlyRate` |
| Mongo bulk insert pressure | Batch 1000; off-peak load test |
| Conditional blocks complexity | Phase C: lite evaluator; defer edge cases to M11-G |
| Credit drift Arivu vs AMDS | Reserve at start; reconcile on webhook + admin sync |

---

## 12. Success metrics

| Metric | Target |
|--------|--------|
| Send API response time | &lt; 500ms at any list size |
| User-perceived “send started” | Immediate (202 + toast) |
| Prep throughput | ≥ 200 recipients/sec sustained (staging) |
| Duplicate send rate | 0 on retry |
| CRM merge tag resolution (production) | 100% for declared template tags |
| Enterprise max campaign | 500,000 |

---

## 13. Implementation order (start here)

**Week 1 — M11-A**

1. Add `campaignSendConstants.js` + queue service (copy import queue pattern).
2. Add `sendState` to Campaign model + migration-safe defaults.
3. Orchestrator stub: enqueue → call existing `sendCampaignBatch` for small lists.
4. Controller returns 202.

**Week 2 — M11-B**

5. `CampaignRecipient` model + snapshot service.
6. Wire orchestrator resolve phase.

**Week 3–4 — M11-C**

7. Merge scope service + chunk worker.
8. Refactor `sendCampaignBatch` internals.

**Week 5+ — M11-D, E, F**

9. Progress API + UI.
10. Schedule freeze + resume tests.
11. Load test + policy limit updates.

---

## 14. Related documents

| Document | Purpose |
|----------|---------|
| [MARKETING_APPLICATION_ROADMAP.md](./MARKETING_APPLICATION_ROADMAP.md) | Parent marketing phases M0–M10 |
| [ARIVU-TRACK-4-DRAFT.md](./ARIVU-TRACK-4-DRAFT.md) | Current send implementation |
| [MARKETING_DYNAMIC_AUDIENCE_SPEC.md](./MARKETING_DYNAMIC_AUDIENCE_SPEC.md) | Segment resolution |
| [ARIVU-TRACK-6-PHASE1-DRAFT.md](./ARIVU-TRACK-6-PHASE1-DRAFT.md) | Credits + plan limits |
| [ARIVU-INTEGRATION.md](./ARIVU-INTEGRATION.md) | AMDS API contract |

---

*Maintained in Arivu repo at `docs/MARKETING_CAMPAIGN_SEND_SCALE_ROADMAP.md`.*
