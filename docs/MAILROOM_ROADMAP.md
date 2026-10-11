# Mailroom — Implementation Roadmap

**Source spec:** [`MAILROOM_IMPLEMENTATION_REQUIREMENT.md`](./MAILROOM_IMPLEMENTATION_REQUIREMENT.md) (Enterprise Mailroom & Channel Ingestion Platform)

**Product placement:** **Settings → Automation → Mailroom** (alongside Assignment Rules, Automation Rules, Processes, Business Flows)

**Last updated:** 2026-05-28 (M0–M7 v1 complete; OpenSearch optional later)

---

## 1. Executive summary

The **Mailroom** is Arivu’s **conversation-first** ingestion layer: every inbound message (email, portal, chat, API) is received, validated, stored raw, normalized, threaded, deduplicated, and **linked to operational records** (primarily Helpdesk **Cases**) via **tenant-configurable policies**—not hardcoded business rules in application code.

| Layer | Owns |
|--------|------|
| **Mailroom** | Connectors, normalization, conversations, threading, dedup, attachments, routing decisions, event publishing |
| **Cases module** | SLA, status, assignment, escalations, resolution/reopen execution |
| **Automation (Process Designer / rules)** | Workflows triggered by Mailroom events |

**Goal for Arivu:** One platform that supports **any business model** (B2B helpdesk, internal IT, partner portals, CRM-adjacent comms) by making **policies and connectors** data-driven, while keeping **operational logic** in Cases and Automation.

---

## 2. Requirements analysis (from spec)

### 2.1 What the spec defines

- **Not** an email parser or webhook-only service—it is **infrastructure**: connectors → pipeline → conversation → case link → events → dispatcher.
- **Conversation-first:** `Conversation` groups messages; `Case` is the execution object (SLA, owner, status).
- **Universal normalized message schema** (channel-agnostic JSON).
- **Async-only processing** (queues, retries, DLQ, raw payload retention).
- **Threading** via Message-ID, In-Reply-To, References, thread IDs, sender/subject (prioritized).
- **Dedup** with configurable outcomes: append, child case, flag, manual review.
- **Case linking** limited to: create case, append activity, reopen—**no SLA/assignment/workflow inside Mailroom**.
- **Events:** `message.received`, `conversation.created`, `case.created`, `case.reopened`, `duplicate.detected`, `processing.failed`, etc.
- **Channels (in scope):** Email, Live Chat, Customer/Partner Portal, API, internal manual.
- **Out of scope (v1):** AI summarization, voice/video, social listening, predictive AI routing.

### 2.2 Spec vs “no hardcoded business logic”

The requirement document includes **example defaults** (e.g. “1 incoming email = 1 Case”, “append to open case”, “reopen resolved case”). These must be implemented as **tenant policies with defaults**, not `if (channel === 'email')` branches in code.

| Spec behavior | Implementation approach |
|---------------|-------------------------|
| Default: new inbound → new case | **Case link policy** default action: `create_case` |
| Reply → append open case | **Threading policy** match: open case on thread → `append` |
| Reply → reopen resolved | **Case link policy** match: resolved within window → `reopen` (Cases API) |
| Duplicate handling | **Dedup policy** (already partially in `channelRules`; migrate to Mailroom) |
| Classification (type, priority, spam) | **Classification rules** (optional rules engine; suggestions only unless policy says auto-apply) |
| Email metadata required | **Connector + parser** contract; enforced in validation layer |

---

## 3. Current state in Arivu (baseline)

### 3.1 Already exists (reuse / evolve)

| Area | Location | Notes |
|------|----------|--------|
| Inbound email pipeline | `server/platform/communication/inbound/inboundDispatcher.js` | Parse → tenant resolve → thread → persist `Communication` |
| Async inbound | `server/services/inboundEmailQueueService.js`, Bull + Redis | Matches spec queue requirement |
| MIME parse / normalize body | `inboundParser.js`, `replyContentNormalizer.js` | Partial normalization layer |
| Thread resolution | `threadResolver.js` | Message-ID / references / subject |
| Communications model | `server/models/Communication.js` | Email-centric; `threadId`, `relatedTo`, RFC headers |
| Helpdesk case ingest | `server/services/helpdeskChannelIngestionService.js` | **Case-first** duplicate modes; should move behind Mailroom |
| Channel rules in settings | `HelpdeskExecutionSettings.vue` / `helpdeskSettingsController.js` | `duplicateHandling`, defaults—**migrate to Mailroom policies** |
| Events (partial) | `communicationEventWriter`, automation engine | Extend with Mailroom event catalog |
| Assignment / automation | `assignmentRulesEngine`, Process Designer | Triggered **after** Mailroom publishes events |

### 3.2 Delivered (M0–M4 + follow-ups)

| Area | Location | Status |
|------|----------|--------|
| Policy engine + templates | `server/platform/mailroom/policies/` | ✅ Threading, dedup, case link, **ingest** |
| Email pipeline (strangler) | `emailInboundPipeline.js`, `inboundDispatcher.js` | ✅ Raw MIME + Arivu parser paths |
| Conversation + messages | `MailroomConversation`, `MailroomMessage` | ✅ Persist on inbound |
| Raw payloads + replay | `MailroomRawPayload`, failures UI | ✅ Admin replay from Settings |
| Threading audit | `MailroomThreadingLog` | ✅ Monitoring tab |
| Case adapter | `adapters/casesAdapter.js` | ✅ create / append / reopen / flag |
| Events + dispatcher | `events/publisher.js`, `events/dispatcher.js` | ✅ Audit in `mailroom_message_events` |
| Tenant config API | `mailroomSettingsController.js` | ✅ CRUD, evaluate, failures, logs |
| Settings UI | `MailroomSettings.vue` | ✅ Tabbed: Overview, Routing, Processing, Monitoring, Developer |
| Channel rules migration | `migrateHelpdeskChannelRulesToMailroom.js` | ✅ Script + mapper |
| Unit tests | `npm run test:mailroom` | ✅ Policy engine, pipeline, events, adapter |

**Ingest routing (post-M3):** Ordered rules on `to` / `from` / `subject` / etc. with actions `route_to_case_flow`, `workspace_only`, `manual_review`, `ignore` — evaluated **before** threading/dedup/case-link in the pipeline.

**Legacy path:** When Mailroom is **disabled**, `helpdeskChannelIngestionService` still handles email. When **enabled**, case decisions go through Mailroom policies + `casesAdapter`.

### 3.3 Remaining gaps vs Mailroom spec

| Gap | Priority | Target phase |
|-----|----------|--------------|
| Portal / Chat / API connectors under one Mailroom API | — | ✅ M5–M6 (`genericInboundPipeline`, public API, portal, chat) |
| `mailroom_attachments` collection + attachment queue | P1 | ✅ collection + upload; malware queue in M7 |
| `mailroom_routing_logs` (adapter outcome trace) | P2 | M7 |
| Classification policy engine + UI | — | ✅ Processing tab + pipeline apply |
| `create_child_case` full adapter execution | — | ✅ M3.1 (`casesAdapter`) |
| Bull DLQ worker extension (beyond failure replay UI) | — | ✅ M4.1 (`processingFailureRetryWorker`) |
| Case record timeline reads from `mailroom_messages` | — | ✅ M2.1 (`caseTimelineAdapter` + conversation lookup) |
| Search across mailroom corpus (OpenSearch) | P2 | Deferred (Mongo `GET …/search` shipped) |
| SPF/DKIM/DMARC + virus scan hooks centralized | — | ✅ M7 (`emailAuthValidator`, Settings → Monitoring) |
| `mailroom_routing_logs` (adapter outcome trace) | — | ✅ M7 |
| Canned responses / agent email templates | P1 | Helpdesk 1C (Cases UI) |
| E2E smoke: `smoke:mailroom` | — | ✅ `npm run smoke:mailroom` |

---

## 4. Architecture (target)

### 4.1 High-level flow

```text
Channel Connectors (email webhook, IMAP sync, portal API, chat, public API)
        ↓
   Mailroom Ingress API  (<1s ACK)
        ↓
   raw_payloads + ingestion_queue
        ↓
   Pipeline workers (validate → parse → normalize → attachments)
        ↓
   Conversation Engine + Threading Engine (policy evaluation)
        ↓
   Dedup Engine (policy evaluation)
        ↓
   Case Link Adapter  →  Cases API only (create / append / reopen)
        ↓
   Event Publisher  →  Automation / Notifications / Process Designer
```

### 4.2 Module boundaries (strict)

```text
server/platform/mailroom/
  connectors/          # Channel-specific ingress only
  pipeline/            # Stages (pure functions + workers)
  domain/              # Conversation, NormalizedMessage, policies
  policies/            # Evaluators (read config, no business constants)
  adapters/            # casesAdapter, communicationsAdapter, automationAdapter
  events/              # Event envelope + publisher
  api/                 # Admin + ingest REST routes
  workers/             # Bull queue processors
```

**Rule:** Mailroom **never** imports SLA monitors, assignment engines, or status transition tables. It calls **Cases** and emits **events**.

### 4.3 Policy-driven design (flexibility for all businesses)

All “business logic” lives in **versioned tenant configuration** evaluated by generic engines:

| Policy type | Purpose | Example knobs (tenant UI) |
|-------------|---------|---------------------------|
| **Ingest policy** ✅ | Which messages enter case flow vs workspace/manual review/ignore | Ordered rules on headers/participants; default action |
| **Threading policy** | Ordered strategies to resolve conversation/case | Signal weights, fallback to subject+sender |
| **Dedup policy** | When duplicate detected | `append` \| `child_case` \| `flag` \| `manual_review` \| `ignore` |
| **Case link policy** | What to do after conversation resolved | `create_case`, `append_only`, `reopen_if_within_days`, `never_create` |
| **Classification policy** | Suggest or set fields | Rules on subject/domain → case type, priority, queue tag |
| **Dispatch policy** | Which automation events fire | Map `case.created` → Process X |

Policies are stored as JSON (Mongo `TenantMailroomConfig` or nested under `TenantAppConfiguration` for HELPDESK), validated by schema, with **system defaults** shipped as seed templates—not hardcoded in services.

```javascript
// Anti-pattern (do NOT do this in Mailroom core)
if (channel === 'email' && !existingCase) createCase();

// Target pattern
const decision = await policyEngine.evaluate('case_link', {
  context: normalizedMessage,
  conversation,
  candidates: { openCases, recentCases }
});
await caseLinkAdapter.execute(decision); // decision.action from policy only
```

### 4.4 Data model (Mongo collections)

Aligned with spec §19; namespaced under `mailroom_*` or dedicated models:

| Collection | Purpose |
|------------|---------|
| `mailroom_raw_payloads` | Immutable inbound bytes + headers + connector metadata |
| `mailroom_conversations` | Conversation container, participants, channel mix |
| `mailroom_messages` | Normalized messages (universal schema) |
| `mailroom_attachments` | Metadata + storage key (binary in object storage) |
| `mailroom_message_events` | Timeline / audit |
| `mailroom_threading_logs` | Decision trace (signals, matched rule id) |
| `mailroom_routing_logs` | Dispatcher / adapter outcomes |
| `mailroom_processing_failures` | DLQ + retry count |

**Relationship to existing `Communication`:** Phase M1 keeps writing `Communication` for backward compatibility; Phase M2+ dual-writes or reads via adapter until UI uses `mailroom_messages` + Conversation API.

### 4.5 Normalized message schema (canonical)

Single schema for all channels (from spec §10); store in `mailroom_messages` with `channel`, `direction`, `participants`, `body` / `htmlBody`, `externalMessageId`, `threadId`, `conversationId`, `metadata` (channel-specific opaque bag).

---

## 5. Settings UI — Automation → Mailroom

### 5.1 Navigation

Extend `client/src/components/settings/AutomationSettings.vue`:

| Card | Route / view |
|------|----------------|
| **Mailroom** | `?tab=automation&automationView=mailroom` (in-shell, like Assignment Rules) |

Sub-sections (tabs inside Mailroom settings — **shipped**):

| Tab | Contents |
|-----|----------|
| **Overview** | Enable toggle, policy template, pipeline diagram, summary cards linking to other tabs |
| **Routing** | Ingest policies — ordered rules (field/operator/value → action) + default action |
| **Processing** | Threading → Dedup → Case link (numbered steps 1–3) |
| **Monitoring** | Processing failures (replay) + threading decision logs |
| **Developer** | Sample policy evaluation against fixture context |

Sticky header (status badge + tab nav) and sticky bottom **Save** bar. Tab choice persists in `localStorage`.

**Not yet in UI:** Connectors (IMAP/Gmail/M365), queue-depth dashboard (metrics API exists).

### 5.2 Migrate Helpdesk channel rules ✅

`helpdeskExecution.channelRules` duplicate/default fields migrate into **Mailroom dedup + case link policies** via `npm run migrate:helpdesk-channel-rules-mailroom:apply`. Helpdesk Execution Settings keeps **SLA / business hours / escalation** only; channel rules show a legacy note pointing to Mailroom.

---

## 6. Integration map

| Consumer | Integration |
|----------|-------------|
| **Cases** | `casesAdapter`: `createCase`, `appendActivity`, `reopenCase` — existing APIs |
| **Communications / Inbox** | Optional mirror to `Communication` for CRM modules |
| **Automation engine** | Subscribe to Mailroom events (`message.received`, `case.created`, …) |
| **Process Designer** | Triggers on same event bus (Phase M4+) |
| **Notifications** | Dispatcher invokes notification service from dispatch policy |
| **People** | Auto-create sender (existing `autoCreatePersonForSender` → adapter) |

---

## 7. Phased roadmap

Work phases in order. Update the progress tracker as exit criteria are met.

### Progress tracker

| Phase | Status | Focus |
|-------|--------|--------|
| **M0** — Foundation & policies | ✅ Done | Policy engine, templates, tenant config API, Automation → Mailroom UI, unit tests (`npm run test:mailroom`) |
| **M1** — Email behind Mailroom | ✅ Done | Raw payload store + policy eval + strangler on MIME webhook & Arivu parser (`MAILROOM_EMAIL_ENABLED` or per-tenant toggle) |
| **M2** — Conversation + threading | ✅ Done | Persist conversations/messages, threading logs, enriched candidates, threading UI |
| **M3** — Dedup + case link policies | ✅ Done | `casesAdapter` executes policies; parser path skips legacy helpdesk when Mailroom on; channel-rules migration |
| **M3.1** — Ingest routing + settings UX | ✅ Done | First-class `ingest` policy; tabbed Settings UI (Overview / Routing / Processing / Monitoring / Developer) |
| **M4** — Events + dispatcher | ✅ Done | Event publisher, failure tracking, replay UI |
| **M5** — API + Portal connectors | ✅ Done | Public ingest API, portal ingest/reply/attachments, Connectors tab, `docs/MAILROOM_API.md`, `npm run smoke:mailroom` |
| **M6** — Chat connector | ✅ Done | Embeddable widget + public instance key + chat sessions/messages + case integration + SSE + typing indicators |
| **M4.1** — Failure retry worker | ✅ Done | `processingFailureRetryWorker` (interval replay of open failures; disable via `MAILROOM_FAILURE_RETRY_ENABLED=false`) |
| **M7** — Hardening & scale | ✅ Done (v1) | Email auth hooks, attachment scan integration, metrics API + Prometheus, routing logs, Mongo search; OpenSearch deferred |

### What works today (operator checklist)

- [x] Enable Mailroom per org (Settings → Automation → Mailroom) or via `MAILROOM_EMAIL_ENABLED`
- [x] Configure **which emails enter case flow** (Routing → ingest rules)
- [x] Configure threading order, dedup behavior, case link defaults (Processing tab)
- [x] Inbound email/parser path: raw payload → ingest → threading → dedup → case adapter → events
- [x] View threading logs and replay failed processing (Monitoring tab)
- [x] Migrate legacy Helpdesk channel rules to Mailroom policies
- [x] Local simulation: `npm run simulate:parser-inbound -- --enable-mailroom`
- [x] Portal and Public API channels through same pipeline (connectors)
- [x] Classification rules in UI (Processing → Classification)
- [x] Enterprise email security hooks (SPF/DKIM/DMARC) — Settings → Mailroom → Monitoring
- [x] `smoke:mailroom` E2E script (`npm run smoke:mailroom`, requires `HELPDESK_AUTH_TOKEN`)

---

### Phase M0 — Foundation & policy framework (2–3 weeks)

**Goal:** Establish Mailroom as a platform module with **zero** channel-specific business rules in code.

**Deliverables**

- [x] `server/platform/mailroom/` package layout + README
- [x] Mongoose models: `MailroomRawPayload`, `MailroomConversation`, `MailroomMessage`, `TenantMailroomConfig`
- [x] Policy validators (`mailroomPolicyValidator.js`)
- [x] `policyEngine.evaluate(type, context)` + `evaluatePipeline`
- [x] Default policy templates: helpdesk standard, strict 1:1, append-only threading
- [x] Settings: **Automation → Mailroom** (`MailroomSettings.vue`)
- [x] API: `GET/PUT /api/settings/automation/mailroom`, `POST …/evaluate`, `GET …/templates`

**Exit criteria:** Policies can be saved/loaded and evaluated against fixture messages in unit tests without touching Cases. **Met.**

**Next:** [Phase M1 — Email behind Mailroom](#phase-m1--email-ingress-behind-mailroom-2-3-weeks)

---

### Phase M1 — Email ingress behind Mailroom (2–3 weeks) ✅

**Goal:** All inbound email ACKs through Mailroom; retain current behavior via **default policy template**.

**Deliverables**

- [x] `mailroom_raw_payloads` written when Mailroom enabled (inline base64 ≤4MB)
- [x] `inboundEmailQueueService` → `processRawMimeThroughMailroom` strangler → `processRawInbound`
- [x] Arivu parser → `processParserEventThroughMailroom` → legacy `processParserInboundEventLegacy`
- [x] Pipeline: parse → normalize → `evaluatePipeline` → legacy handlers
- [x] Toggle: **Settings → Mailroom → Enable** or env `MAILROOM_EMAIL_ENABLED=true`

**Exit criteria:** Production email path unchanged when Mailroom off; when on, raw payloads + policy trace retained. **Met.**

**Next:** [Phase M2 — Conversation + threading](#phase-m2--conversation-engine--threading-policies-3-4-weeks)

---

### Phase M2 — Conversation engine + threading policies (3–4 weeks) ✅

**Goal:** Conversation-first model live for email; threading decisions auditable and configurable.

**Deliverables**

- [x] `mailroom_conversations` CRUD + link messages on inbound (M2 persistence service)
- [x] Threading policy UI (ordered signals: enable/disable, reorder)
- [x] `mailroom_threading_logs` on every inbound decision
- [x] Case record timeline reads from `mailroom_messages` via `caseTimelineAdapter` (linked case + conversation `primaryCaseId`)

**Exit criteria:** Tenants can change threading order/weights without deploy; logs explain why a message attached to case A vs B. **Met** (threading order via UI; logs in Settings → Mailroom).

**Next:** [Phase M3 — Dedup & case link policies](#phase-m3--dedup--case-link-policies-2-3-weeks)

---

### Phase M3 — Dedup & case link policies (2–3 weeks) ✅

**Goal:** Remove business logic from `helpdeskChannelIngestionService.js`; migrate Helpdesk channel rules.

**Deliverables**

- [x] Dedup policy evaluation + execution plan in `casesAdapter`
- [x] Case link policy → `casesAdapter.executeMailroomCaseLink` (create / append / reopen / flag)
- [x] Parser + Mailroom email path uses adapter (skips `handleInboundEmailForHelpdesk` when Mailroom enabled)
- [x] Raw MIME Mailroom path passes `mailroomPrelinkedCase` to skip duplicate helpdesk ingest
- [x] Migration script: `helpdeskExecution.channelRules` → Mailroom policies
- [x] Settings UI for dedup + case link policy editing
- [x] Migration script: `helpdeskExecution.channelRules` → Mailroom policies

**Exit criteria:** Mailroom-enabled ingest executes case_link/dedup via adapter. **Met** for email/parser paths. Legacy helpdesk service still used when Mailroom is off.

**Next:** [Phase M3.1 — Ingest routing & settings UX](#phase-m31--ingest-routing--settings-ux)

---

### Phase M3.1 — Ingest routing & settings UX ✅

**Goal:** Separate “should this message enter case flow?” from threading/dedup/case-link; organize scattered settings into a coherent operator UI.

**Deliverables**

- [x] `ingest` policy type in `mailroomPolicies.js` + `policyEngine.evaluate('ingest')`
- [x] Pipeline evaluates ingest **before** threading/dedup/case-link (`route_to_case_flow` | `workspace_only` | `manual_review` | `ignore`)
- [x] Settings UI: ingest rule builder (field, operator, value, action) + default action
- [x] Tabbed Mailroom settings: Overview, Routing, Processing, Monitoring, Developer
- [x] Locale keys + pipeline diagram on Overview tab

**Exit criteria:** Tenants can route e.g. `to contains support@company.com` → case flow without code deploy. **Met.**

**Next:** [Phase M4 — Event publishing & dispatcher](#phase-m4--event-publishing--dispatcher-2-3-weeks)

---

### Phase M4 — Event publishing & dispatcher (2–3 weeks) ✅

**Goal:** Mailroom drives Automation and notifications via explicit events.

**Deliverables**

- [x] Event envelope + publisher (`mailroom/events/publisher.js`)
- [x] Required events from spec §17 (audit in `mailroom_message_events`)
- [x] Dispatcher: map events → domain events per dispatch policy (skips duplicate case.created/reopened)
- [x] Admin UI: failed jobs list + replay from raw payload
- [x] `mailroom_processing_failures` model + replay service
- [x] Bull DLQ worker extension — `processingFailureRetryWorker` replays open `mailroom_processing_failures` on an interval (Settings replay UI unchanged)

**Exit criteria:** `case.created` from Mailroom triggers existing assignment automation; failures recoverable from UI. **Met** — case create still flows through `caseExecutionService.onCaseCreated`; Mailroom publishes audit events and records failures with replay.

**Next:** [Phase M5 — API & portal connectors](#phase-m5--api--portal-connectors-3-4-weeks)

---

### Phase M5 — API & portal connectors (3–4 weeks) ✅

**Goal:** Non-email channels use same pipeline and policies.

**Deliverables**

- [x] REST API: ingest message, append conversation, upload attachment (spec §6.5) — `/api/public/mailroom`, see `docs/MAILROOM_API.md`
- [x] Portal connector adapter (customer/partner) — auth scoped to requester (`portalMailroomController`, `portalSafety`)
- [x] Normalization for portal/chat-shaped payloads into universal schema (`genericInboundPipeline`)
- [x] Portal policies: customer/partner allow create/reply + audience detection in Connectors tab
- [x] Connectors tab in Mailroom settings (API keys, portal limits, email toggles, chat toggle)
- [x] `npm run smoke:mailroom` — settings, failures, threading logs, policy evaluate

**Exit criteria:** Portal-created case and reply flow through Mailroom; internal notes never exposed via portal adapter. **Met** (see `mailroomPortalSafety` tests).

**Depends on:** Helpdesk **Phase 1D** (portal case APIs) for end-to-end portal flows.

---

### Phase M6 — Live chat connector (2–3 weeks, can defer)

**Goal:** Support embeddable live chat with tenant routing, realtime updates, and end-to-end case handling.

**Deliverables**

- [x] Public **instance key** resolution (Option B: `inst_chat_*` key stored on master `Organization`)
- [x] Embeddable widget assets: `client/public/embed/chat.js` + `client/public/embed/chat/widget.html`
- [x] Public embed REST: create session, post/list messages, SSE stream (`/embed/chat/*`)
- [x] Tenant chat persistence: `ChatSession` + `ChatMessage` (tenant DB)
- [x] Auto-create + link Helpdesk Case on first inbound chat message (`channel = Live Chat`)
- [x] Authenticated case chat API: list messages, stream SSE, agent send, typing (`/api/helpdesk/cases/:id/chat/*`)
- [x] Case record UX: live chat cases show chat thread as the workspace conversation surface; bottom composer routes to chat automatically
- [x] Typing indicators (visitor ↔ agent), TTL-based (in-memory) for now

**Exit criteria:** Visitor can chat from an embedded widget, agent can handle it inside the Case record in realtime. **Met.**

---

### Phase M7 — Security, observability, search ✅ (v1)

**Goal:** Enterprise readiness per spec §21–22.

**Deliverables**

- [x] SPF/DKIM/DMARC validation hooks on email connector (`emailAuthValidator.js` — parses `Authentication-Results` / `Received-SPF`; monitor / quarantine / reject in Settings → Monitoring)
- [x] Malware scan integration point (`attachmentScanService.js` — webhook via `MAILROOM_SCAN_WEBHOOK_URL` or tenant toggle)
- [x] Metrics: ingest rate, latency, duplicate rate, DLQ depth (`mailroomMetrics.js`, `GET …/mailroom/metrics`, `GET /health/mailroom-metrics` Prometheus text)
- [x] `mailroom_routing_logs` + Monitoring UI viewer
- [x] Mongo search API (`GET …/mailroom/search?q=`)
- [ ] Optional OpenSearch index (deferred — Mongo text index on `mailroom_messages` for v1)

---

## 8. Migration strategy (Helpdesk Cases)

| Current | Target |
|---------|--------|
| `inboundDispatcher` → `helpdeskChannelIngestionService` | `inboundDispatcher` → **Mailroom pipeline** → `casesAdapter` |
| `HelpdeskExecutionSettings` channel rules | **Mailroom policies** (Automation → Mailroom) |
| Case `activities[]` for email text | Populated by Cases API when adapter appends (Mailroom passes normalized body) |
| `Communication` threads | Dual-write or read-through during transition |

**Principle:** Strangler fig—one channel (email) at a time, feature-flagged per tenant.

---

## 9. Technology choices (Arivu-aligned)

Spec §27 recommends NestJS/RabbitMQ/Postgres; **Arivu already uses:**

| Concern | Choice |
|---------|--------|
| Runtime | Node.js + Express (keep) |
| Queue | **Bull + Redis** (already used for inbound email) |
| Primary DB | **MongoDB** (tenant + master) |
| File storage | Existing uploads / S3-compatible paths |
| Search (later) | Mongo text indexes first; OpenSearch if volume requires |

No mandatory stack rewrite for Mailroom v1.

---

## 10. Testing & verification

| Layer | Approach |
|-------|----------|
| Policy engine | Fixture-based unit tests per policy type |
| Pipeline | Integration tests with sample MIME + API payloads |
| Cases adapter | Contract tests against case APIs (mock DB) |
| E2E | Extend `smoke:helpdesk` → `smoke:mailroom` (ingest + policy load + health) |
| Replay | Admin replays `raw_payload` through pipeline in staging |

---

## 11. Risks & decisions to lock early

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | Conversation vs Communication | Introduce `mailroom_conversations`; keep `Communication` for CRM until unified inbox v2 |
| 2 | Policy storage | Dedicated `TenantMailroomConfig` collection vs `TenantAppConfiguration.settings.mailroom` — prefer **dedicated** for versioning/audit |
| 3 | Default email behavior | Ship **template** “Helpdesk standard” matching current behavior; tenants opt into others |
| 4 | Case creation | Mailroom **requests**; Cases module **executes** (SLA cycle creation stays in Cases) |
| 5 | Multi-app | Mailroom is **platform** (org-scoped); case link policy selects `appKey` + `moduleKey` (not HELPDESK-only code paths) |

---

## 12. Definition of done (Mailroom v1)

| Criterion | Status |
|-----------|--------|
| All inbound **email** passes through Mailroom pipeline with raw payload retention (when enabled) | ✅ |
| Conversations exist; messages use universal normalized schema | ✅ (email) |
| Ingest, threading, dedup, and case link **policy-configurable** in Settings → Automation → Mailroom | ✅ |
| No SLA/assignment/status logic inside Mailroom | ✅ |
| Events published for automation/notifications | ✅ |
| Failed messages recoverable (replay from Settings UI) | ✅ |
| Bull DLQ worker extension + queue-depth ops dashboard | 🟡 Retry worker ✅; queue-depth dashboard ❌ M7 |
| `helpdeskChannelIngestionService` retired when Mailroom on for all tenants | 🟡 Strangler: legacy off when Mailroom disabled only |
| Portal + chat + public API through same pipeline | ✅ M5–M6 |
| Classification policy UI + pipeline apply | ✅ |
| Dispatch policy UI | ❌ Post-M7 |
| Documentation + `smoke:mailroom` for operators | ✅ `docs/MAILROOM_API.md` + `npm run smoke:mailroom` |
| `create_child_case` dedup behavior in `casesAdapter` | ✅ |
| Case timeline from `mailroom_messages` | ✅ `caseTimelineAdapter` |

**Mailroom v1 for email is effectively complete.** Remaining v1 gaps are multi-channel connectors, hardening, and operational polish.

---

## 13. Relationship to Helpdesk Cases roadmap

| Helpdesk phase | Mailroom interaction |
|----------------|----------------------|
| **1C Email hardening** | **Partially in Mailroom** — threading/dedup/case-link/ingest UI done (M0–M3.1). Remaining 1C: agent templates/macros, case timeline from Mailroom messages |
| **1D Portals** | Portal connector in **M5** (align with Helpdesk 1D APIs) |
| **1G Process Designer** | Mailroom events published (**M4**); Process Designer subscription is Helpdesk **1G** |

**Recommended sequence:** Enable Mailroom for pilot tenants → **M5** (portal/API) in parallel with Helpdesk **1D** → **M6** chat → **M7** hardening.

---

## 14. Next actions (immediate)

1. **Pilot rollout:** Enable Mailroom on staging/pilot orgs; run `migrate:helpdesk-channel-rules-mailroom:apply` where channel rules exist; run `npm run smoke:mailroom`.
2. **M7:** SPF/DKIM/DMARC hooks on inbound connector, malware scan queue, metrics, OpenSearch, routing logs viewer.
3. **Post-M7:** Classification policy engine + UI; dispatch policy UI; IMAP/Gmail/M365 connector settings.
4. **Helpdesk 1C remainder:** Canned responses / email templates in agent workspace (not Mailroom core).
5. **Strangler exit:** Retire `helpdeskChannelIngestionService` for email once all tenants run Mailroom enabled.

---

*For the full functional specification, see [`MAILROOM_IMPLEMENTATION_REQUIREMENT.md`](./MAILROOM_IMPLEMENTATION_REQUIREMENT.md).*
