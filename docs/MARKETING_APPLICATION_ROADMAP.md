# Marketing Application — Implementation Roadmap

**Source PRD:** `Arivu Marketing Application PRD` v1.0 (Draft)  
**Platform dependency:** AMDS Track 4 complete — see [ARIVU-TRACK-4-DRAFT.md](./ARIVU-TRACK-4-DRAFT.md) · [AMDS_INTEGRATION_ROADMAP.md](./AMDS_INTEGRATION_ROADMAP.md)  
**Architecture reference:** [Architecture_Document.md](./Architecture_Document.md) §4–5 (app entitlements, permissions, tenant isolation)

**Product goal:** CRM-native marketing operations — audiences, campaigns, templates, scheduling, and analytics — with **all email delivery delegated to AMDS**.

**Last updated:** 2026-07-01

---

## Separation doctrine (locked)

> **Arivu Marketing owns the customer experience.** **AMDS owns outbound email infrastructure.**

| Responsibility | Arivu Marketing | AMDS |
|----------------|-------------------|------|
| Campaign CRUD, audiences, segments | ✅ | — |
| Email builder, templates, merge fields | ✅ | — |
| Scheduling intent (when to send) | ✅ submits | ✅ executes |
| SMTP, queue, retry, bounce, complaint | — | ✅ |
| Open/click pixels, link wrapping | — | ✅ |
| Delivery webhooks → stats | ✅ consumes | ✅ emits |
| Domain authentication UI | Settings proxy (Track 3) | ✅ DNS/SPF/DKIM |
| Subscription / preference center pages | ✅ hosted in Arivu | — |

Hard rule: **No SMTP, queue, or retry logic in Marketing code paths.** All sends go through `AmdsClient.sendCampaignBatch()` (Track 4) or future AMDS schedule APIs.

---

## Progress tracker

| Phase | Scope | Status | Target |
|-------|-------|--------|--------|
| **M0** — App shell & platform registration | App definition, entitlements, permissions, dashboard shell | ✅ Done | 1–2 weeks |
| **M1** — Campaign MVP | List/create/edit/send + stats UI on Track 4 backend | ✅ Done | 2–3 weeks |
| **M2** — Audience management | Static/dynamic lists, import/export, duplicate detection | ✅ Done | 2 weeks |
| **M3** — Segmentation | Segment builder (CRM fields, tags, nested AND/OR) | ✅ Done | 2–3 weeks |
| **M3.5** — Dynamic Audience Engine | Metadata-driven builder, relationship traversal, preview insights | ✅ Done | 4–6 weeks |
| **M4** — Email builder & template library | Core ContentTemplate (`outputFormat=email`), marketing list + campaign apply | ✅ Done | 3–4 weeks |
| **M5** — Scheduling, testing, personalization | Schedule later, test send, previews, conditional blocks | ✅ Done | 2 weeks |
| **M6** — Marketing dashboard & analytics | KPI dashboard, campaign comparison, link performance | ✅ Done | 2 weeks |
| **M7** — Subscription management | Unsubscribe, preference center, consent history | ✅ Done | 1–2 weeks |
| **M8** — Marketing assets | Image/logo library (OCI Object Storage) | ✅ Done | 1–2 weeks |
| **M9** — Approval workflow | Draft → reviewer → approved → scheduled → sent | ✅ Done | 2–3 weeks |
| **M10** — Reports & A/B testing | Performance reports, subject/content splits | ✅ Done | 2–3 weeks |
| **M11** — Campaign send scale (500K) | Async queue, snapshot, chunk workers, CRM merge hydration | ❌ Not started | 6–8 weeks |
| **Future** — PRD §6 | Journey builder, AI content, multi-channel, attribution | ❌ Out of v1 | TBD |

**PRD module mapping**

| PRD §3 Module | Phase |
|---------------|-------|
| 3.1 Marketing Dashboard | M6 |
| 3.2 Audience Management | M2 |
| 3.3 Segmentation | M3 · M3.5 |
| 3.4 Campaign Management | M1 (+ M9 states) |
| 3.5 Visual Email Builder | M4 |
| 3.6 Template Library | M4 |
| 3.7 Personalization | M4–M5 |
| 3.8 Campaign Scheduling | M5 |
| 3.9 Campaign Testing | M5 |
| 3.10 A/B Testing | M10 |
| 3.11 Campaign Analytics | M1 (basic) · M6 (full) |
| 3.12 Subscription Management | M7 |
| 3.13 Marketing Assets | M8 |
| 3.14 Approval Workflow | M9 |
| 3.15 Reports | M10 |

---

## Current state

**Next up:** [M11 — Campaign send scale](./MARKETING_CAMPAIGN_SEND_SCALE_ROADMAP.md) (async pipeline, 500K recipients). PRD §6 enhancements remain out of v1 scope.

### Shipped (M0–M10)

| Area | Status | Location |
|------|--------|----------|
| App registration + middleware | ✅ | `appKeys.js`, `requireMarketingAppMiddleware.js`, seed |
| Campaign CRUD + send + analytics | ✅ | `marketingCampaignController.js`, Track 4 AMDS |
| Campaign schedule + test send + precheck (M5) | ✅ | `marketingCampaignScheduleService.js`, `sendCampaignTest.js`, `marketingCampaignContentValidationService.js` |
| Marketing dashboard KPIs + link performance (M6) | ✅ | `marketingDashboardService.js`, `MarketingDashboard.vue` |
| Subscription + preference center (M7) | ✅ | `MarketingSubscriptionPreference.js`, `PreferenceCenter.vue`, `sendCampaignBatch.js` |
| Marketing asset library (M8) | ✅ | `MarketingAsset.js`, `marketingAssetService.js`, `AssetsLibrary.vue` |
| Campaign approval workflow (M9) | ✅ | `marketingCampaignApprovalService.js`, `CampaignApprovalPanel.vue`, `CampaignApprovalsList.vue` |
| Audience CRUD + import/export | ✅ | `MarketingAudience.js`, `marketingAudienceController.js` |
| Segment CRUD + refresh job | ✅ | `MarketingSegment.js`, `marketingSegmentRefreshScheduler.js` |
| Dynamic audience engine (M3.5) | ✅ | See [MARKETING_DYNAMIC_AUDIENCE_SPEC.md](./MARKETING_DYNAMIC_AUDIENCE_SPEC.md) |
| Metadata API + v2 AST | ✅ | `marketingAudienceMetadataService.js`, `GET /segments/metadata` |
| Relationship + aggregate query compiler | ✅ | `marketingAudienceQueryCompiler.js`, `marketingAudienceLinkResolver.js`, `marketingAudienceAggregateEvaluator.js` |
| Preview insights + explain | ✅ | `marketingAudiencePreviewService.js`, `marketingAudienceExplainService.js`, `POST /segments/explain` |
| Segment builder UI | ✅ | `SegmentBuilder.vue`, `AudienceRelationshipRulesPanel.vue`, `useMarketingAudienceMetadata.js` |
| Client routes + views | ✅ | `client/src/views/marketing/*` |
| i18n + PostHog + module visits | ✅ | `marketing.json`, `posthogMarketing.ts` |
| Tests | ✅ | `npm run test:marketing-audiences` (26 tests) |

### Not implemented (M10+)

| Gap | Phase |
|-----|-------|
| GrapesJS email builder + template library | M4 ✅ (core ContentTemplate) |
| Asset library | M8 ✅ |
| Approval workflow | M9 ✅ |
| Reports + A/B testing | M10 |

---

## Architecture

Follow the **Helpdesk / Inventory app pattern** — not a Settings-scoped feature (unlike Webforms).

```
Users
  │
  ▼
Arivu Frontend  (/marketing/*, /dashboard/marketing)
  │
  ▼
Arivu API       (/api/marketing/*  →  req.appKey = MARKETING)
  │
  ├── CRM data     (people, organizations, deals, cases, tags, custom fields)
  ├── Marketing DB (Campaign, Audience, Segment, MarketingAsset)
  ├── Core Templates (ContentTemplate, outputFormat=email for marketing)
  │
  ▼
AMDS               (sendCampaignBatch, schedule, analytics, webhooks)
  │
  ▼
Recipient mail servers
```

### App registration (mirror Helpdesk)

| Layer | Pattern | Marketing target |
|-------|---------|------------------|
| Platform seed | `APP_DEFINITIONS` + `MODULE_DEFINITIONS` | `appKey: 'marketing'`, modules: `campaigns`, `audiences`, `templates`, `segments` |
| App key constant | `APP_KEYS.MARKETING` | Add to `appKeys.js` + `VALID_APP_KEYS` |
| URL namespace | `/api/helpdesk` → HELPDESK | `/api/marketing` → MARKETING |
| App middleware | `requireHelpdeskApp` | `requireMarketingApp` on marketing routers |
| Entitlement | `requireAppEntitlement` + org `enabledApps` | Same |
| Client dashboard | `/dashboard/helpdesk` | `/dashboard/marketing` |
| Client modules | `/helpdesk/cases` static routes | `/marketing/campaigns`, `/marketing/audiences`, etc. |
| Sidebar | `buildSidebarFromRegistry.ts` path prefix | Add `['/marketing/', 'MARKETING']` |
| Special routes | `appRegistryNetwork.ts` `specialAppRoutes` | Add `/marketing/` |

### Data models (new collections)

| Model | Purpose | Tenant-scoped |
|-------|---------|---------------|
| `Campaign` | ✅ exists — extend for PRD fields | Yes (`wrapTenantModel`) |
| `MarketingAudience` | Static/dynamic recipient lists | Yes |
| `MarketingSegment` | Reusable filter definitions | Yes |
| `EmailTemplate` | ~~HTML builder output~~ → **use `ContentTemplate`** (`outputFormat: email`) | Yes |
| `MarketingAsset` | Images, logos, documents (OCI refs) | Yes |
| `CampaignRecipient` | Per-recipient send state (optional; may use `Communication`) | Yes |
| `SubscriptionPreference` | Consent + category prefs per person | Yes |

**Reuse:** `Communication` records for per-recipient delivery/engagement (Track 4 pattern). Do not duplicate delivery state on a second model unless query performance requires it.

### API surface

Middleware stack (same as Helpdesk case routes):

`protect` → `organizationIsolation` → `resolveAppContext` → `requireAppEntitlement` → `requireMarketingApp` → `checkPermission`

| Purpose | Method | Route | Permission |
|---------|--------|-------|------------|
| List campaigns | GET | `/api/marketing/campaigns` | `campaigns.view` |
| Create campaign | POST | `/api/marketing/campaigns` | `campaigns.create` |
| Get / update / delete | GET / PUT / DELETE | `/api/marketing/campaigns/:id` | `campaigns.view` / `edit` / `delete` |
| Duplicate / archive | POST | `/api/marketing/campaigns/:id/duplicate` | `campaigns.create` |
| Send / schedule | POST | `/api/marketing/campaigns/:id/send` | `campaigns.send` |
| Analytics | GET | `/api/marketing/campaigns/:id/analytics` | `campaigns.view` |
| Test send | POST | `/api/marketing/campaigns/:id/test` | `campaigns.send` |
| List audiences | GET | `/api/marketing/audiences` | `audiences.view` |
| CRUD audiences | POST / GET / PUT / DELETE | `/api/marketing/audiences/:id` | `audiences.*` |
| Preview audience | POST | `/api/marketing/audiences/:id/preview` | `audiences.view` |
| Import / export | POST / GET | `/api/marketing/audiences/:id/import` · `export` | `audiences.edit` |
| CRUD segments | `/api/marketing/segments` | | `segments.*` |
| CRUD templates | `/api/templates?outputFormat=email` (core) | | `templates.*` |
| CRUD assets | `/api/marketing/assets` | | `assets.*` |
| Marketing dashboard KPIs | GET | `/api/marketing/dashboard` | `campaigns.view` |
| Public preference center | GET / POST | `/api/public/marketing/preferences/:token` | None (token-scoped) |

Mount in `server.js`:

```javascript
app.use('/api/marketing/campaigns', marketingCampaignRoutes);   // exists — add middleware
app.use('/api/marketing/audiences', marketingAudienceRoutes);   // M2
app.use('/api/marketing/segments', marketingSegmentRoutes);     // M3
app.use('/api/marketing/templates', marketingTemplateRoutes);   // removed — use /api/templates
app.use('/api/marketing/assets', marketingAssetRoutes);         // M8
app.use('/api/marketing/dashboard', marketingDashboardRoutes);  // M6
app.use('/api/public/marketing', marketingPublicRoutes);        // M7
```

### Client routes

| Route | Component | Phase |
|-------|-----------|-------|
| `/dashboard/marketing` | `MarketingDashboard.vue` | M0 shell · M6 KPIs |
| `/marketing/campaigns` | `CampaignsList.vue` | M1 |
| `/marketing/campaigns/new` | `CampaignEditor.vue` | M1 |
| `/marketing/campaigns/:id` | `CampaignDetail.vue` | M1 |
| `/marketing/audiences` | `AudiencesList.vue` | M2 |
| `/marketing/audiences/:id` | `AudienceDetail.vue` | M2 |
| `/marketing/segments` | `SegmentsList.vue` | M3 |
| `/marketing/segments/:id` | `SegmentBuilder.vue` | M3 |
| `/marketing/templates` | redirect → `/templates` (core; not in Marketing sidebar) | M4 |
| `/marketing/assets` | `AssetsLibrary.vue` | M8 |
| `/marketing/reports` | `MarketingReports.vue` | M10 |
| `/marketing/preferences/:token` | `PreferenceCenter.vue` (public) | M7 |

Register static routes in `client/src/router/index.js` (same pattern as `/helpdesk/cases`). Add `/marketing/` to `specialAppRoutes` in `appRegistryNetwork.ts`.

### Permissions & roles (PRD §5)

New permission bundles under `appPermissions.MARKETING`:

| Module key | Actions | PRD role mapping |
|------------|---------|------------------|
| `campaigns` | view, create, edit, delete, send, approve | Creator, Manager, Reviewer |
| `audiences` | view, create, edit, delete, import, export | Creator, Manager |
| `segments` | view, create, edit, delete | Creator, Manager |
| `templates` | view, create, edit, delete, share | Creator, Manager |
| `assets` | view, create, edit, delete | Creator, Manager |
| `reports` | view, export | Analyst, Manager |
| `settings` | view, edit | Administrator |

Seed default role templates in `rolePermissionCatalogService.js`. Map PRD personas:

- **Marketing Administrator** — all MARKETING modules + settings
- **Marketing Manager** — campaigns send/approve, audiences, reports
- **Campaign Creator** — campaigns create/edit, audiences, templates (no approve)
- **Campaign Reviewer** — campaigns view + approve
- **Marketing Analyst** — view + reports export

People participation: extend `participations.MARKETING` people type defaults in tenant seeder (`Customer`, `Subscriber`).

### AMDS integration points (by phase)

| Phase | AMDS API / webhook | Arivu usage |
|-------|-------------------|----------------|
| M1 | `POST /v1/campaigns/:id/messages` | ✅ `sendCampaignBatch` |
| M1 | Webhooks `message.delivered|bounced|opened|clicked` | ✅ `campaignStatsHandler` |
| M1 | `GET /v1/analytics/summary` | ✅ analytics proxy |
| M5 | Schedule API (if available) | Submit `scheduledAt`, timezone, quiet hours |
| M5 | Single-message send | Test email via `sendMessage` + tracking |
| M7 | — | Unsubscribe links rendered in HTML before AMDS send |
| M10 | Analytics aggregation | A/B variant comparison |

Confirm AMDS schedule/recurring API availability before M5 implementation; stub with Arivu cron + immediate send if AMDS schedule is not ready.

### Platform integrations (consumer only)

| Service | Marketing usage |
|---------|-----------------|
| `people` module | Audience members, merge fields, participation |
| `organizations` | Org-level segments |
| `deals`, `cases`, `items` | Segment filter sources |
| Tags + custom fields | Segment builder |
| `sourceResolver` | Tag campaigns `source: marketing_campaign` |
| `automationEngine` | Post-send triggers (future) |
| `notificationEngine` | Approval notifications (M9) |
| OCI upload middleware | Asset library (M8) |
| `deletionService` | Trashable campaigns, audiences, templates |

---

## Phase M0 — App shell & platform registration

**Exit criteria:** Marketing appears in app switcher for entitled tenants; dashboard loads; permissions enforced; no send UI yet.

**Status:** ✅ Done (2026-06-30)

### Server

- [x] Add `MARKETING: 'MARKETING'` to `server/constants/appKeys.js`
- [x] Add `/api/marketing` → `MARKETING` in `resolveAppContextMiddleware.js`
- [x] Create `server/middleware/requireMarketingAppMiddleware.js`
- [x] Extend `seedPlatformDefinitionsWithUI.js`:
  - App: `marketing`, icon `megaphone`, `defaultRoute: '/dashboard/marketing'`, order 4
  - Modules: `campaigns`, `audiences`, `templates`, `segments` (sidebar entries; routes phased)
- [x] Enums updated — opt-in via App Registry (not bulk-seeded to all tenants)
- [x] `rolePermissionCatalogService.js` — MARKETING module catalog
- [x] Wrap existing campaign routes: `resolveAppContext`, `requireAppEntitlement`, `requireMarketingApp`, `checkPermission`

### Client

- [x] `client/src/router/index.js` — `/dashboard/marketing`, `/marketing` redirect
- [x] `client/src/views/marketing/MarketingDashboard.vue` — shell (mirror `InventoryDashboard.vue`)
- [x] `appRegistryNetwork.ts` — add `/marketing/` to `specialAppRoutes`
- [x] `buildSidebarFromRegistry.ts` — path prefix `['/marketing/', 'MARKETING']`
- [x] `navigation.json` + `marketing.json` i18n (en + sync)
- [x] App marketplace card metadata in seed (`marketplace.category: 'Sales'`, `beta: true`)

### Onboarding merge checklist (M0)

| ☐ | Item |
|---|------|
| ✅ | i18n — `navigation.appMarketing`, dashboard blurb |
| ✅ | FIRST_TIME empty state on campaigns + audiences lists |
| ✅ | Module visit tracking via `recordModuleVisit` (campaigns, audiences, dashboard) |
| ✅ | PostHog — `marketing_app_opened`, `marketing_dashboard_viewed`, `marketing_module_visited` |
| ✅ | Platform Home — entitled app tile when MARKETING enabled |
| ✅ | Permissions — dashboard hidden without `campaigns.view` |

**Estimate:** 1–2 weeks

---

## Phase M1 — Campaign MVP

**Exit criteria:** Marketer creates a campaign, selects recipients from people, sends via AMDS, sees delivery/open/click stats on detail page.

### Server — extend existing

- [x] `Campaign` model — add: `campaignType`, `audienceId`, `templateId`, `scheduledAt`, `amdsCampaignId`, expanded `status` enum (align PRD: draft, scheduled, running, paused, completed, cancelled, archived)
- [x] `marketingCampaignController.js` — list, update, delete, duplicate, pause, resume, cancel, archive
- [x] Recipient resolution — accept `audienceId` or inline `{ email, recipientId, mergeData }[]`
- [x] Link campaign send to audience members (M2 stub: inline recipients only until M2)
- [x] Permission checks: `campaigns.send` for send endpoint

### Client

- [x] `CampaignsList.vue` — `ModuleList`-style or dedicated list with status filters
- [x] `CampaignEditor.vue` — name, subject, from, HTML body (textarea MVP; GrapesJS in M4)
- [x] `CampaignDetail.vue` — stats cards (Track 4 sketch), recipient table with engagement badges
- [x] Send drawer — recipient picker (people search), confirm send
- [x] Empty states: `FIRST_TIME`, `NO_DATA`

### Tests

- [x] Extend `validate-amds-track4-campaign.js` for full API flow
- [x] Controller tests for CRUD + permission denial

**Estimate:** 2–3 weeks (backend mostly done)

---

## Phase M2 — Audience management

**Exit criteria:** Create static lists, import CSV, export, preview contacts, basic duplicate detection.

**Status:** ✅ Done (2026-06-30)

### Server

- [x] `server/models/MarketingAudience.js` — type (`static`|`dynamic`), member refs, import metadata
- [x] `marketingAudienceController.js` + routes
- [x] Import — CSV upload (email column auto-detect)
- [x] Export — streaming CSV
- [x] Duplicate detection — email match against people + list members
- [x] Dynamic list stub — `segmentId` FK (wired in M3)

### Client

- [x] `AudiencesList.vue`, `AudienceDetail.vue`
- [x] Import wizard, member preview panel
- [x] Link audience to campaign editor + send drawer

**Estimate:** 2 weeks

---

## Phase M3 — Segmentation

**Exit criteria:** Build reusable segments with CRM field filters, AND/OR groups; dynamic segments refresh member counts.

**Status:** ✅ Done (2026-06-30)

### Server

- [x] `server/models/MarketingSegment.js` — filter AST (reuse list filter / automation condition patterns)
- [x] `marketingSegmentQueryService.js` — compile filters → Mongo query on `people`
- [x] Filter sources: CRM fields (name, email, phone, assignedTo, organization, sales_type, helpdesk_role)
- [x] Background job: refresh dynamic segment counts (`marketingSegmentRefreshScheduler`, cron every 15m)
- [x] Dynamic audiences wired via `segmentId` → `resolveSegmentRecipients`

### Client

- [x] `SegmentsList.vue`, `SegmentBuilder.vue` — reuses `FilterBuilderPanel`
- [x] Live count preview
- [x] Dynamic audience type + segment picker in `AudienceDetail.vue`

**Estimate:** 2–3 weeks

---

## Phase M3.5 — Dynamic Audience Engine (relationship-aware)

**Spec:** [MARKETING_DYNAMIC_AUDIENCE_SPEC.md](./MARKETING_DYNAMIC_AUDIENCE_SPEC.md)  
**Exit criteria:** Metadata-driven segment builder; 1–3 hop relationship traversal; preview insights; legacy M3 segment compatibility.

**Status:** ✅ Done (2026-07-01)

### Server

- [x] `marketingAudienceMetadataService.js` — fields, relationships, graph from platform metadata
- [x] `GET /api/marketing/segments/metadata` · `POST /api/marketing/segments/explain`
- [x] `MarketingSegment` — `primaryEntity`, `filterQueryVersion`, `explainSummary`
- [x] v2 AST validation — `marketingAudienceAstValidator.js`
- [x] `marketingAudienceQueryCompiler.js` — multi-hop traversal, legacy v1 fallback
- [x] `marketingAudienceLinkResolver.js` — FK + `RelationshipInstance`, `expandPrimaryToTargetIds`
- [x] `marketingAudienceAggregateEvaluator.js` — exists / not_exists / count / sum / avg / min / max
- [x] `marketingAudiencePreviewService.js` — reachable, missing email, suppressed, duplicates, org/industry breakdown
- [x] `marketingSegmentQueryService.js` — delegates to query compiler for preview, count, send resolution
- [x] Contact resolution when primary ≠ people (orgs, deals, cases → people with email)

### Client

- [x] `useMarketingAudienceMetadata.js` — metadata composable
- [x] `SegmentBuilder.vue` — metadata-driven fields; primary entity selector; live preview + explain
- [x] `AudienceRelationshipRulesPanel.vue` — multi-hop path picker; exists / not_exists / count / sum / avg
- [x] `marketingAudienceFilterConfig.js` — v2 AST build/hydrate (replaces hardcoded field list)
- [x] Removed `marketingPeopleFilterConfig.js`

### Tests

- [x] `npm run test:marketing-audiences` — metadata, link resolver, aggregate evaluator, preview, segment controller

| Sub-phase | Scope | Status |
|-----------|-------|--------|
| A | Metadata API + v2 AST + no hardcoded fields | ✅ Done |
| B | Single-hop relationships + preview insights | ✅ Done |
| C | Multi-hop paths + aggregate count/sum/avg | ✅ Done |
| D | Engagement rules, query plan cache, versioning | ⬜ Future (see spec §19) |

**Estimate:** 4–6 weeks (actual)

> **Next:** **M4 — Email builder & template library**

## Phase M4 — Email builder & template library

**Exit criteria:** Drag-and-drop responsive emails; save to template library; apply template to campaign.

### Server

- [x] Core `ContentTemplate` — `outputFormat: email`, GrapesJS project in `ContentTemplateVersion`
- [x] `GET /api/templates?outputFormat=email` filter on core list API
- [x] Merge fields via core template builder (`VariablesPanel`, people module scope)

### Client

- [x] Campaign editor applies core email templates (`outputFormat=email`); manage via `/templates`

**Reuse:** GrapesJS already exists in `client/src/modules/template/` (platform template builder). M4 should adapt that module for marketing email templates rather than greenfield.

**Estimate:** 3–4 weeks

---

## Phase M5 — Scheduling, testing, personalization

**Exit criteria:** Schedule send for later; send test email; validate merge fields; conditional content blocks (basic).

**Status:** ✅ Done (2026-07-01)

### Server

- [x] Campaign `scheduledAt`, `timezone`, `quietHours`, `businessHours` fields
- [x] Schedule submit — Arivu scheduler → `sendCampaignBatch` at time (`marketingCampaignScheduleScheduler.js`)
- [x] `POST /campaigns/:id/test` — single recipient via `AmdsClient.sendMessage`
- [x] Merge field validation service — scan HTML for unresolved `{{field}}`
- [x] Conditional block syntax parser (lite — HubSpot `{% if %}` detection + explain)

### Client

- [x] Schedule picker in send flow
- [x] Test send modal
- [x] Pre-send checklist (links, merge fields)

**Estimate:** 2 weeks

---

## Phase M6 — Marketing dashboard & analytics

**Exit criteria:** PRD §3.1 dashboard — active/draft/scheduled campaigns, KPIs, recent activity, quick actions.

**Status:** ✅ Done (2026-07-01)

### Server

- [x] `marketingDashboardService.js` — aggregate campaign stats, audience growth
- [x] Link performance — from Communication click metadata
- [x] Campaign comparison endpoint (`GET /api/marketing/dashboard/compare`)

### Client

- [x] Replace dashboard shell with KPI cards, activity feed, top campaigns, link performance
- [x] Quick actions: New campaign, New audience, View campaigns/audiences/segments

**Estimate:** 2 weeks

---

## Phase M7 — Subscription management

**Exit criteria:** Unsubscribe link in campaigns; public preference center; consent history on person record.

**Status:** ✅ Done (2026-07-01)

### Server

- [x] `MarketingSubscriptionPreference` model — categories, opt-in/out timestamps, history
- [x] Signed token for public preference URLs (`marketingPreferenceToken.js`)
- [x] `GET/PUT /api/public/marketing/preferences/:token` + `POST /unsubscribe`
- [x] Append unsubscribe footer helper used before AMDS send

### Client

- [x] `PreferenceCenter.vue` (public route)
- [x] Person record panel — subscription history (`PeopleMarketingSubscriptionsPanel.vue`)

**Estimate:** 1–2 weeks

---

## Phase M8 — Marketing assets

**Exit criteria:** Upload images/logos to OCI; pick assets in email builder.

### Server

- [x] `MarketingAsset` model — OCI object key, mime, dimensions
- [x] Upload/list/delete routes — reuse org-scoped upload middleware

### Client

- [x] `AssetsLibrary.vue` — grid, upload, search
- [x] Asset picker in GrapesJS

**Estimate:** 1–2 weeks

---

## Phase M9 — Approval workflow

**Exit criteria:** PRD §3.14 flow — draft → reviewer → approved → scheduled → sent; comments and history.

### Server

- [x] Campaign approval fields — `approvalStatus`, `reviewers[]`, `approvalHistory[]`
- [x] State machine guards — only approved campaigns can schedule/send
- [x] Notifications to reviewers via `notificationEngine`

### Client

- [x] Approval panel on campaign detail
- [x] Reviewer inbox / pending approvals list

**Estimate:** 2–3 weeks

---

## Phase M10 — Reports & A/B testing

**Exit criteria:** Export campaign performance PDF/Excel; basic A/B subject line test with winner selection.

### Server

- [x] Report generators — campaign performance, audience growth, engagement trends
- [x] A/B variant model on Campaign — split %, winner metric, auto-select winner
- [x] AMDS metadata tags per variant for analytics split

### Client

- [x] `MarketingReports.vue` — date range, export buttons
- [x] A/B config UI in campaign editor

**Estimate:** 2–3 weeks

---

## Future enhancements (PRD §6 — out of v1)

Architecture should not block these; do not implement until v1 ships:

- Marketing Journey Builder
- Automation workflows (cross-app with `automationEngine`)
- AI content generation / subject line suggestions
- Send-time optimization
- Multi-channel (SMS, WhatsApp, push) — separate provider adapters
- Lead scoring
- Customer journey analytics
- Attribution reporting

---

## File checklist (M0–M3.5)

| File | Action | Phase |
|------|--------|-------|
| `server/constants/appKeys.js` | Add `MARKETING` | M0 |
| `server/middleware/resolveAppContextMiddleware.js` | Add `/api/marketing` | M0 |
| `server/middleware/requireMarketingAppMiddleware.js` | **New** | M0 |
| `server/scripts/seedPlatformDefinitionsWithUI.js` | Marketing app + modules | M0 |
| `server/services/rolePermissionCatalogService.js` | MARKETING permissions | M0 |
| `server/routes/marketingCampaignRoutes.js` | Add middleware + list/update/delete | M0–M1 |
| `server/controllers/marketingCampaignController.js` | Extend CRUD | M1 |
| `server/models/Campaign.js` | Extend schema | M1 |
| `server/models/MarketingAudience.js` | **New** | M2 |
| `server/models/MarketingSegment.js` | **New** · extend for v2 AST | M3 · M3.5 |
| `server/services/marketing/marketingAudienceMetadataService.js` | **New** | M3.5 |
| `server/services/marketing/marketingAudienceQueryCompiler.js` | **New** | M3.5 |
| `server/services/marketing/marketingAudienceLinkResolver.js` | **New** | M3.5 |
| `server/services/marketing/marketingAudienceAggregateEvaluator.js` | **New** | M3.5 |
| `server/services/marketing/marketingAudiencePreviewService.js` | **New** | M3.5 |
| `server/services/marketing/marketingAudienceAstValidator.js` | **New** | M3.5 |
| `server/services/marketing/marketingAudienceExplainService.js` | **New** | M3.5 |
| `server/services/marketing/marketingAudienceFieldCompiler.js` | **New** | M3.5 |
| `client/src/composables/useMarketingAudienceMetadata.js` | **New** | M3.5 |
| `client/src/components/marketing/AudienceRelationshipRulesPanel.vue` | **New** | M3.5 |
| `client/src/utils/marketingAudienceFilterConfig.js` | **New** | M3.5 |
| `client/src/router/index.js` | Marketing routes | M0 |
| `client/src/views/marketing/*` | **New** views | M0–M3 |
| `client/src/locales/en/marketing.json` | **New** i18n | M0 |
| `client/src/utils/appRegistryNetwork.ts` | `/marketing/` special route | M0 |
| `client/src/utils/buildSidebarFromRegistry.ts` | Path prefix | M0 |
| `docs/MARKETING_DYNAMIC_AUDIENCE_SPEC.md` | M3.5 implementation spec | M3.5 |

---

## Risks & dependencies

| Risk | Mitigation |
|------|------------|
| AMDS schedule/recurring API not ready | M5: Arivu cron triggers `sendCampaignBatch` at `scheduledAt` |
| GrapesJS bundle size | Lazy-load editor route; code-split |
| Dynamic segment query cost | Cache counts; refresh on schedule not on every page load; slow-query logging on preview >3s |
| Large audience sends | M11 roadmap — async queue + chunk workers; Track 4 AMDS API chunks 500/msg only |
| Permission sprawl | Start with `campaigns` + `audiences`; add modules as phases ship |
| Tenant trial scope | Default new tenants to SALES only; MARKETING opt-in via app enablement |

---

## Success metrics (v1)

| Metric | Target |
|--------|--------|
| Time to first campaign send | < 15 min (with existing audience) |
| Campaign stats latency | < 30 s after webhook (real-time UI) |
| i18n check | `npm run i18n:check` clean |
| Tenant isolation | All queries filtered by `organizationId` |
| Zero SMTP in marketing path | Code review + lint rule on marketing services |

---

## Related documents

| Document | Purpose |
|----------|---------|
| [ARIVU-TRACK-4-DRAFT.md](./ARIVU-TRACK-4-DRAFT.md) | Campaign send + analytics (done) |
| [MARKETING_CAMPAIGN_SEND_SCALE_ROADMAP.md](./MARKETING_CAMPAIGN_SEND_SCALE_ROADMAP.md) | M11 — 500K async send pipeline |
| [AMDS_INTEGRATION_ROADMAP.md](./AMDS_INTEGRATION_ROADMAP.md) | Platform email provider integration |
| [ARIVU-INTEGRATION.md](./ARIVU-INTEGRATION.md) | AMDS API contract |
| [WEBFORM_BUILDER_ROADMAP.md](./WEBFORM_BUILDER_ROADMAP.md) | Reference for phased roadmap format |
| [USER_ONBOARDING_ARCHITECTURE.md](./USER_ONBOARDING_ARCHITECTURE.md) | New app merge checklist |

---

*Maintained in Arivu repo at `docs/MARKETING_APPLICATION_ROADMAP.md`.*
