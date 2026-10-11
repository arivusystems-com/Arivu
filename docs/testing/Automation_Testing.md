# Arivu Platform — Automation Testing Reference

> **Repo:** `Arivu` · **Product:** Arivu  
> **Purpose:** Exhaustive test-case catalog for API automation, E2E business flows, and UI automation.  
> **Companions:** `Architecture_Document.md` (schemas, tenancy, middleware) · **`atp/`** (Arivu Test Platform — runner, dashboard, human-readable case docs)  
> **Last updated:** June 2026

---

## How to Use This Document

| Layer | Tooling (recommended) | ID prefix |
|-------|----------------------|-----------|
| **API automation** | **ATP** (`atp/`) · Node harness · Postman / k6 | `TC-API-*` |
| **E2E business flows** | **ATP** · Playwright + API setup fixtures | `TC-E2E-*` |
| **UI automation** | **ATP** · Playwright (Vue SPA, dynamic routes, tabs, SSE) | `TC-UI-*` |
| **Public / webhook** | **ATP** · HTTP + HMAC/token fixtures | `TC-PUB-*` |
| **Security / tenancy** | **ATP** · Negative API + cross-org fixtures | `TC-SEC-*` |
| **Async / jobs** | **ATP** · API trigger + worker/cron polling | `TC-ASYNC-*` |
| **Load testing** | **ATP** · concurrent VUs (`atp/runner/lib/loadTest.mjs`) | `TC-LOAD-*` |
| **Performance** | **ATP** · sequential latency SLAs (p95/p99) | `TC-PERF-*` |

**Test environments:** local (`docker-compose`), UAT (`docs/UAT_DEV_ENVIRONMENT.md`), dedicated tenant DB org, master-org control plane.  
**Seed:** `npm run seed:internal-beta` in `server/` (see `docs/INTERNAL_BETA_TEST_FLOWS.md`).  
**Never use `DISABLE_SECURITY=true` in CI/UAT automation** except dedicated security-bypass unit tests.

### Table columns → human-readable documentation (ATP)

Each row in this file is the **source of truth** for the ATP catalog. On `npm run catalog:sync`, ATP parses tables and builds **`documentation`** per case (visible in the dashboard and run results).

| Column in this doc | Maps to ATP field | Meaning |
|--------------------|-------------------|---------|
| **ID** | `id` | Stable case ID, e.g. `TC-API-AUTH-001` |
| **Method** / **Type** | `request.method` | HTTP verb or `BROWSER` for UI |
| **Path** / route in **Scenario** | `request.path` | API path or client route |
| **Scenario** | `summary` + `howToRun` | What is being verified and how to execute |
| **Expected** | `expected.behavior` + `expected.status` | Pass criteria |
| *(implicit)* | `onFailure` | Auto-generated remediation (API down, personas, seeds, Playwright) |

**You do not need to duplicate docs in this file for every row** — keep tables concise. For critical flows, add an optional **Case detail** block (§1.1 template or §7) or override in `atp/fixtures/case-docs-overrides.json`.

### Arivu Test Platform (ATP) — quick run

```bash
cd atp
cp .env.example .env          # ATP_PERSONA_OWNER_EMAIL/PASSWORD
cp fixtures/personas.example.json fixtures/personas.json
npm install && npm run playwright:install
npm run catalog:sync          # this file → atp/catalog/index.json + documentation

# SUT: server :3000, client :5173
npm run run:smoke             # PR gate (~8 cases)
npm run run:full              # all 799 runnable automated cases
```

| ATP artifact | Purpose |
|--------------|---------|
| `atp/catalog/index.json` | Synced catalog + per-case `documentation` |
| `atp/catalog/case-docs.json` | Standalone documentation map |
| `atp/catalog/suites.json` | `smoke`, `e2e-critical`, `full`, `security`, … |
| Dashboard http://localhost:3100 | Expand any catalog row or run result for full case doc |
| `docs/testing/ATP_USER_GUIDE.md` | Schedules, Go/No-Go, reports, Docker stack |

**Coverage (June 2026):** **799 / 799** runnable IDs automated (~100%). Six rows are **section headers** only (e.g. `TC-SEC-MT`, `TC-PUB-BOOK`) — not executable. Generated smokes assert status bands; hand-written suites in `atp/runner/definitions/` hold deeper assertions.

### Test Personas

| Persona | Apps | Role | Primary surfaces |
|---------|------|------|------------------|
| `owner` | All enabled | Owner | Full settings, billing, app enablement |
| `sales_admin` | SALES | Admin | Pipelines, users, assignment rules |
| `sales_rep` | SALES | User (own scope) | People, deals, tasks, inbox |
| `sales_manager` | SALES | Manager (team scope) | Team deals, reports |
| `helpdesk_agent` | HELPDESK | User | Cases, inbox |
| `helpdesk_admin` | HELPDESK | Admin | SLA, mailroom, case schema |
| `auditor` | AUDIT only | User | `/audit/*` — blocked from SALES modules |
| `portal_user` | PORTAL only | External | `/portal/*` |
| `viewer` | SALES | Viewer | Read-only, delete denied |
| `platform_admin` | CONTROL_PLANE | Master org | Demo requests, instances, inbound parser |
| `unauthenticated` | — | — | Public routes only |

---

## 1. Platform Gates (Run First)

### 1.1 Auth & Session

| ID | Type | Scenario | Expected |
|----|------|----------|----------|
| TC-API-AUTH-001 | API | POST `/api/auth/login` valid credentials | 200 `{ user, organization, token }` |
| TC-API-AUTH-002 | API | POST `/api/auth/login` invalid password | 401 |
| TC-API-AUTH-003 | API | POST `/api/auth/login` rate limit exceeded (6th attempt/15min prod) | 429 |
| TC-API-AUTH-004 | API | POST `/api/auth/register` new org | 201 + token |
| TC-API-AUTH-005 | API | POST `/api/auth/register` duplicate email | 4xx |
| TC-API-AUTH-006 | API | GET `/api/users/profile` with Bearer token | 200 refreshed user + org |
| TC-API-AUTH-007 | API | GET `/api/users/profile` expired/invalid token | 401 |
| TC-API-AUTH-008 | API | GET `/api/auth/test-version` | 200 (public) |
| TC-UI-AUTH-001 | UI | `/login` → valid login → redirect to saved route or platform home | Session in Pinia + localStorage |
| TC-UI-AUTH-002 | UI | `/login` invalid credentials | Error message, no redirect |
| TC-UI-AUTH-003 | UI | Protected route without auth → `/login` + `arivu_redirect_after_login` | Redirect after login |
| TC-UI-AUTH-004 | UI | Logout clears token, redirects to login | No API calls with stale token |
| TC-UI-AUTH-005 | UI | Cold start: login → dynamic routes registered from `/api/ui/registry` | Sidebar modules visible |

#### Case detail: TC-API-AUTH-001 (template)

Use this pattern in overrides or future rows when a case needs more than a table line.

| Field | Value |
|-------|--------|
| **Summary** | Owner login returns a valid JWT and user profile |
| **How to run** | 1. POST `/api/auth/login` with owner email/password from `atp/fixtures/personas.json`. 2. Assert HTTP 200 and token in body. 3. Token is cached for subsequent cases in the same run. |
| **Request** | `POST /api/auth/login` · Auth: none · Body: `{ "email", "password" }` |
| **Expected** | HTTP 200 · JWT issued; authenticated APIs succeed |
| **If it fails** | Typical: 401 invalid credentials · Check `ATP_PERSONA_OWNER_*`, user exists in tenant, SUT on `:3000` |

Override file: `atp/fixtures/case-docs-overrides.json` (see `case-docs-overrides.example.json`).

### 1.2 App Entitlements

| ID | Scenario | Expected |
|----|----------|----------|
| TC-SEC-APP-001 | SALES user POST `/api/deals` with HELPDESK-only seat | 403 APP_ENTITLEMENT_REQUIRED |
| TC-SEC-APP-002 | GET list on disabled app module | 403 APP_NOT_ENABLED |
| TC-SEC-APP-003 | EXECUTE mutation with expired trial | 402 TRIAL_EXPIRED |
| TC-SEC-APP-004 | AUDIT-only user navigates `/deals` | Redirect `/audit/dashboard` |
| TC-SEC-APP-005 | PORTAL-only user navigates `/people` | Redirect `/portal/dashboard` |
| TC-SEC-APP-006 | Owner on internal instance | INTERNAL_INSTANCE_OVERRIDE bypass |
| TC-SEC-APP-007 | GET (VIEW intent) on enabled app without EXECUTE seat | 200 list |
| TC-SEC-APP-008 | POST (EXECUTE) without seat | 403 EXECUTION_SEAT_REQUIRED |
| TC-SEC-APP-009 | CONFIGURE settings without permission | 403 or tab hidden |
| TC-SEC-APP-010 | EXTERNAL userType on internal SALES route | 403 USER_TYPE_NOT_ALLOWED |

### 1.3 RBAC Permissions

| ID | Scenario | Expected |
|----|----------|----------|
| TC-SEC-RBAC-001 | User without `deals.create` POST `/api/deals` | 403 |
| TC-SEC-RBAC-002 | User with `deals.view` scope `own` — list shows only owned | Filter applied |
| TC-SEC-RBAC-003 | User with scope `team` — sees team records | Filter applied |
| TC-SEC-RBAC-004 | User with scope `all` — full list | No ownership filter |
| TC-SEC-RBAC-005 | Owner/admin bypass on any module action | 200 |
| TC-SEC-RBAC-006 | `people.attach.sales` required for POST `/api/people/:id/attach` appKey=SALES | 403 without |
| TC-SEC-RBAC-007 | `people.lifecycle.manage.sales` for convert-lead-to-contact | 403 without |
| TC-SEC-RBAC-008 | UI: restricted delete button hidden for viewer | No button / disabled |
| TC-SEC-RBAC-009 | UI: restricted delete → API 403, no silent failure | Toast/error |
| TC-SEC-RBAC-010 | Role CRUD: create role → assign user → permission effective on next profile refresh | Matrix applied |

### 1.4 Multi-Tenancy

| ID | Scenario | Expected |
|----|----------|----------|
| TC-SEC-MT-001 | Org A JWT accesses Org B record by ID | 404 or 403 |
| TC-SEC-MT-002 | Request body contains foreign `organizationId` | Ignored/rejected |
| TC-SEC-MT-003 | Dedicated tenant DB: writes inside `tenantContext` land in tenant DB | Proxy routing |
| TC-SEC-MT-004 | Dedicated tenant DB: cron/SLA ticks scoped to tenant | No cross-DB bleed |
| TC-SEC-MT-005 | Import CSV rows appear only in importing org | organizationId isolation |
| TC-SEC-MT-006 | Public quote token from Org A invalid for Org B context | 404 |
| TC-SEC-MT-007 | Embed chat `X-Instance-Key` resolves single org | No cross-instance session |
| TC-SEC-MT-008 | Mailroom ingest key wrong org | 401 |
| TC-SEC-MT-009 | Trash list shows only current org records | Filter |
| TC-SEC-MT-010 | Search results tenant-scoped | No foreign records |

### 1.5 Security Middleware

| ID | Scenario | Expected |
|----|----------|----------|
| TC-SEC-CSRF-001 | Production non-API POST from disallowed origin | 403 CSRF_INVALID_ORIGIN |
| TC-SEC-CSRF-002 | `/api/*` mutating with JWT only (no CSRF cookie) | 200 (JWT path) |
| TC-SEC-RL-001 | Auth login rate limit | 429 after threshold |
| TC-SEC-RL-002 | Public quote view rate limit | 429 |
| TC-SEC-RL-003 | Public quote accept rate limit | 429 |
| TC-SEC-RL-004 | Mailroom public ingest rate limit | 429 |
| TC-SEC-RL-005 | General API limiter fail-open when Redis down | Requests proceed (logged) |
| TC-SEC-RL-006 | Session bootstrap limiter on hot `/api/ui/*` paths | 429 at threshold |

### 1.6 Health & Observability

| ID | Scenario | Expected |
|----|----------|----------|
| TC-API-HEALTH-001 | GET `/health/live` | 200 |
| TC-API-HEALTH-002 | GET `/health/ready` | 200 when DB up |
| TC-API-HEALTH-003 | GET `/health/status` | Component status |
| TC-API-HEALTH-004 | GET `/health/mailroom-metrics` without token | Per controller rules |
| TC-API-HEALTH-005 | GET `/internal/notifications/health` | Internal auth |
| TC-UI-OBS-001 | Frontend error captured in Sentry (UAT) | Event received |
| TC-UI-OBS-002 | PostHog `$pageview` + `user_logged_in` on login | Events tracked |

---

## 2. API Automation — By Domain

### 2.1 Users, Roles, Groups

#### Users (`/api/users`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-USER-001 | GET | `/profile` | Read own profile |
| TC-API-USER-002 | PUT | `/profile` | Update name, phone |
| TC-API-USER-003 | PUT | `/profile/password` | Change password (valid old) |
| TC-API-USER-004 | PUT | `/profile/password` | Wrong old password → 400 |
| TC-API-USER-005 | POST | `/profile/avatar` | Upload avatar image |
| TC-API-USER-006 | DELETE | `/profile/avatar` | Remove avatar |
| TC-API-USER-007 | GET | `/list` | Assignment picker list |
| TC-API-USER-008 | GET | `/add-capabilities` | Invite capabilities |
| TC-API-USER-009 | GET | `/` | Admin list users |
| TC-API-USER-010 | POST | `/` | Create user with role + appAccess |
| TC-API-USER-011 | GET | `/:id` | Get user detail |
| TC-API-USER-012 | PUT | `/:id` | Update user role/apps |
| TC-API-USER-013 | POST | `/:id/reset-password` | Admin reset password |
| TC-API-USER-014 | DELETE | `/:id` | Deactivate user (not hard delete) |
| TC-API-USER-015 | POST | `/` | Non-admin → 403 |

#### Roles (`/api/roles`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-ROLE-001 | GET | `/modules` | Permission catalog for role editor |
| TC-API-ROLE-002 | GET | `/hierarchy` | Role tree |
| TC-API-ROLE-003 | GET | `/` | List roles |
| TC-API-ROLE-004 | GET | `/:id` | Role detail with appPermissions |
| TC-API-ROLE-005 | POST | `/` | Create custom role |
| TC-API-ROLE-006 | POST | `/initialize` | Seed default roles |
| TC-API-ROLE-007 | PUT | `/:id` | Update permissions matrix |
| TC-API-ROLE-008 | DELETE | `/:id` | Delete non-system role |
| TC-API-ROLE-009 | DELETE | `/:id` | System role → blocked |

#### Groups (`/api/groups`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-GRP-001 | POST | `/` | Create group |
| TC-API-GRP-002 | GET | `/` | List groups |
| TC-API-GRP-003 | GET | `/:id` | Group detail |
| TC-API-GRP-004 | PUT | `/:id` | Update group |
| TC-API-GRP-005 | DELETE | `/:id` | Delete group |
| TC-API-GRP-006 | POST | `/:id/members` | Add members |
| TC-API-GRP-007 | DELETE | `/:id/members` | Remove members |
| TC-API-GRP-008 | GET | `/:id/activity-logs` | Group activity |

#### User Preferences (`/api/user-preferences`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-PREF-001 | POST/GET | `/widget-layout` | Save/load dashboard widget layout |
| TC-API-PREF-002 | POST/GET | `/metrics-config` | Save/load metrics config |

---

### 2.2 Organization (Tenant + SALES Accounts)

#### Legacy tenant org (`/api/organization`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-ORG-001 | GET | `/` | Tenant org profile |
| TC-API-ORG-002 | PUT | `/` | Update org (owner) |
| TC-API-ORG-003 | GET | `/stats` | Org statistics |
| TC-API-ORG-004 | GET | `/subscription` | Subscription state |
| TC-API-ORG-005 | POST | `/subscription/upgrade` | Upgrade plan |
| TC-API-ORG-006 | POST | `/subscription/cancel` | Cancel subscription |
| TC-API-ORG-007 | POST | `/apps/enable` | Enable app on tenant |
| TC-API-ORG-008 | POST | `/apps/disable` | Disable app |
| TC-API-ORG-009 | POST | `/:id/apps/enable` | Enable app by id |
| TC-API-ORG-010 | POST | `/:id/apps/disable` | Disable app by id |

#### SALES company accounts v2 (`/api/v2/organization`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-ORGV2-001 | POST | `/` | Create company account |
| TC-API-ORGV2-002 | GET | `/` | List company accounts |
| TC-API-ORGV2-003 | GET | `/:id` | Account detail |
| TC-API-ORGV2-004 | PUT | `/:id` | Update account fields |
| TC-API-ORGV2-005 | DELETE | `/:id` | Soft-delete → trash |
| TC-API-ORGV2-006 | GET | `/:id/surface` | Composed surface payload |
| TC-API-ORGV2-007 | GET | `/:id/activity-logs` | Activity history |
| TC-API-ORGV2-008 | POST | `/:id/activity-logs` | Log manual activity |

#### Organization surface (`/api/organizations`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-ORGS-001 | POST | `/` | Create via surface API |
| TC-API-ORGS-002 | GET | `/:id` | Read surface record |
| TC-API-ORGS-003 | GET | `/:id/editable` | Editable field projection |
| TC-API-ORGS-004 | PATCH/PUT | `/:id` | Partial/full update |
| TC-API-ORGS-005 | GET | `/:id/surface` | Full surface composition |

---

### 2.3 People (Contacts/Leads v2) — `/api/people`

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-PEO-001 | POST | `/resolve-context` | Resolve create context |
| TC-API-PEO-002 | POST | `/resolve-types` | People type definitions |
| TC-API-PEO-003 | POST | `/resolve-quick-create` | Quick-create field projection |
| TC-API-PEO-004 | POST | `/create` | Create person with appKey |
| TC-API-PEO-005 | POST | `/create` | Attach to existing by email |
| TC-API-PEO-006 | POST | `/:id/attach` | Add SALES participation |
| TC-API-PEO-007 | POST | `/:id/detach` | Remove app participation |
| TC-API-PEO-008 | POST | `/:id/convert-lead-to-contact` | Lead → Contact lifecycle |
| TC-API-PEO-009 | GET | `/:id/profile` | Composed profile |
| TC-API-PEO-010 | PUT | `/:id/update-core` | Core identity fields |
| TC-API-PEO-011 | PUT | `/:id/update-app-fields` | participations.{appKey} |
| TC-API-PEO-012 | GET | `/` | List with filters/pagination |
| TC-API-PEO-013 | POST | `/` | Legacy create path |
| TC-API-PEO-014 | GET | `/:id` | Single record |
| TC-API-PEO-015 | PUT | `/:id` | Full update |
| TC-API-PEO-016 | DELETE | `/:id` | Soft-delete → trash |
| TC-API-PEO-017 | GET | `/:id/activity-logs` | Activity feed |
| TC-API-PEO-018 | POST | `/:id/activity-logs` | Manual activity |
| TC-API-PEO-019 | DELETE | `/:id` | Blocked when dependencies exist | 
| TC-API-PEO-020 | PUT | `/:id` | `createdBy` update blocked by hook |

---

### 2.4 Deals — `/api/deals`

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-DEAL-001 | GET | `/dashboard/metrics` | Dashboard KPIs |
| TC-API-DEAL-002 | GET | `/pipeline/summary` | Pipeline summary |
| TC-API-DEAL-003 | GET | `/` | List/kanban data |
| TC-API-DEAL-004 | POST | `/` | Create deal |
| TC-API-DEAL-005 | GET | `/:id` | Deal detail |
| TC-API-DEAL-006 | PUT | `/:id` | Update deal |
| TC-API-DEAL-007 | DELETE | `/:id` | Trash |
| TC-API-DEAL-008 | PATCH | `/:id/stage` | Pipeline stage change |
| TC-API-DEAL-009 | PUT/PATCH | `/:id/tags` | Tag management |
| TC-API-DEAL-010 | POST | `/:id/notes` | Add note |
| TC-API-DEAL-011 | PUT | `/:id/notes/:noteId` | Edit note |
| TC-API-DEAL-012 | GET/POST | `/:id/activity-logs` | Activity |
| TC-API-DEAL-013 | GET | `/:id/description-versions` | Version history |
| TC-API-DEAL-014 | POST | `/:id/description-versions/restore` | Restore description |
| TC-API-DEAL-015 | GET/POST/PUT/DELETE | `/:id/comments` | Comment thread |
| TC-API-DEAL-016 | POST | `/:id/comments/:commentId/reactions` | Reactions |
| TC-API-DEAL-017 | POST | `/:id/comments` + attachment | Comment with file |

---

### 2.5 Tasks — `/api/tasks`

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-TASK-001 | GET | `/stats/summary` | Stats |
| TC-API-TASK-002 | GET | `/summary` | Home summary |
| TC-API-TASK-003 | GET/POST | `/` | List/create |
| TC-API-TASK-004 | GET/PUT/DELETE | `/:id` | CRUD |
| TC-API-TASK-005 | PATCH | `/:id/status` | Status transition |
| TC-API-TASK-006 | PATCH | `/:id/subtasks/:subtaskId` | Subtask toggle |
| TC-API-TASK-007 | PUT/PATCH | `/:id/tags` | Tags |
| TC-API-TASK-008 | GET/POST/PUT/DELETE | `/:id/comments` | Comments + reactions |
| TC-API-TASK-009 | POST | `/:id/comment-attachments` | Attachment upload |
| TC-API-TASK-010 | GET | `/:id/custom-fields` | Custom fields |
| TC-API-TASK-011 | GET | `/:id/description-versions` | Version history |
| TC-API-TASK-012 | POST | `/:id/description-versions/restore` | Restore |
| TC-API-TASK-013 | GET | `/:id/activity-logs` | Activity |

---

### 2.6 Events — `/api/events`

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-EVT-001 | GET | `/summary` | Calendar summary |
| TC-API-EVT-002 | GET | `/` | List events |
| TC-API-EVT-003 | GET | `/stats` | Event stats |
| TC-API-EVT-004 | GET | `/export` | Export events |
| TC-API-EVT-005 | POST | `/` | Create event |
| TC-API-EVT-006 | GET/PUT/DELETE | `/:id` | CRUD |
| TC-API-EVT-007 | POST | `/bulk-delete` | Bulk delete |
| TC-API-EVT-008 | POST | `/:id/notes` | Add note |
| TC-API-EVT-009 | POST | `/:id/start` | Start execution |
| TC-API-EVT-010 | POST | `/:id/check-in` | Geo check-in |
| TC-API-EVT-011 | POST | `/:id/check-out` | Check-out |
| TC-API-EVT-012 | POST | `/:id/submit-audit` | Submit audit form |
| TC-API-EVT-013 | POST | `/:id/approve-audit` | Approve audit |
| TC-API-EVT-014 | POST | `/:id/reject-audit` | Reject audit |
| TC-API-EVT-015 | POST | `/:id/next-org` | Multi-org beat next |
| TC-API-EVT-016 | POST | `/:id/orders` | Field sales orders |
| TC-API-EVT-017 | POST | `/:id/complete` | Complete event |
| TC-API-EVT-018 | POST | `/:id/cancel` | Cancel event |

---

### 2.7 Items & Catalog

#### Items (`/api/items`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-ITEM-001 | GET | `/statistics` | Catalog stats |
| TC-API-ITEM-002 | GET | `/low-stock` | Low stock alert |
| TC-API-ITEM-003 | GET | `/type/:type` | Filter by type |
| TC-API-ITEM-004 | GET/POST | `/` | List/create item |
| TC-API-ITEM-005 | GET/PUT/DELETE | `/:id` | CRUD |
| TC-API-ITEM-006 | PATCH | `/:id/stock` | Stock adjustment |
| TC-API-ITEM-007 | GET/POST/PATCH/DELETE | `/:id/media` | Media gallery |
| TC-API-ITEM-008 | GET/POST/PUT | `/:id/variants` | Variants |
| TC-API-ITEM-009 | POST | `/:id/link-deal` | Link to deal |
| TC-API-ITEM-010 | DELETE | `/:id/unlink-deal/:dealId` | Unlink deal |

#### Catalog (`/api/catalog`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-CAT-001 | GET | `/variants/search` | Variant search |
| TC-API-CAT-002 | GET | `/variants/:variantId` | Variant detail |
| TC-API-CAT-003 | GET | `/variants/:variantId/price-entries` | Price entries |
| TC-API-CAT-004 | GET/PUT | `/variants/:variantId/bundle-components` | Bundle config |
| TC-API-CAT-005 | GET | `/variants/:variantId/bundle-expand` | Expand bundle |
| TC-API-CAT-006 | POST | `/price-books/resolve` | Resolve price |
| TC-API-CAT-007 | CRUD | `/price-books` (+ entries) | Price books |
| TC-API-CAT-008 | CRUD | `/categories` (+ attributes) | Categories |

---

### 2.8 Quotes (CPQ) — `/api/quotes`

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-QTE-001 | GET/POST | `/` | List/create quote |
| TC-API-QTE-002 | GET/PUT/DELETE | `/:id` | CRUD |
| TC-API-QTE-003 | GET | `/:id/revisions` | Revision history |
| TC-API-QTE-004 | GET | `/:id/process-approvals` | Process approvals |
| TC-API-QTE-005 | GET | `/:id/conversion` | Conversion status |
| TC-API-QTE-006 | PATCH | `/:id/status` | Status transition |
| TC-API-QTE-007 | POST | `/:id/submit-for-approval` | Submit → locked |
| TC-API-QTE-008 | POST | `/:id/approve` | Approve quote |
| TC-API-QTE-009 | POST | `/:id/reject` | Reject quote |
| TC-API-QTE-010 | POST | `/:id/send-email` | Email to customer |
| TC-API-QTE-011 | POST | `/:id/share` | Generate public token |
| TC-API-QTE-012 | POST | `/:id/share/revoke` | Revoke token |
| TC-API-QTE-013 | POST | `/:id/convert` | Convert to deal |
| TC-API-QTE-014 | POST | `/:id/recalculate` | Recalc totals |
| TC-API-QTE-015 | PATCH | `/:id/discounts` | Apply discounts |
| TC-API-QTE-016 | POST | `/:id/revise` | New revision |
| TC-API-QTE-017 | CRUD | `/:id/sections` | Quote sections |
| TC-API-QTE-018 | CRUD | `/:id/lines` (+ bundles, reorder) | Line items |
| TC-API-QTE-019 | GET/POST | `/:id/documents` | PDF documents |

---

### 2.9 Forms & Responses

#### Protected forms (`/api/forms`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-FRM-001 | GET/POST | `/` | List/create forms |
| TC-API-FRM-002 | GET/PUT/DELETE | `/:id` | CRUD |
| TC-API-FRM-003 | POST | `/:id/duplicate` | Duplicate form |
| TC-API-FRM-004 | POST | `/:id/enable-public` | Enable public slug |
| TC-API-FRM-005 | POST | `/:id/link-event` | Link to event |
| TC-API-FRM-006 | GET | `/:id/analytics` | Form analytics |
| TC-API-FRM-007 | GET | `/:id/kpis` | KPI metrics |
| TC-API-FRM-008 | POST | `/:id/submit` | Internal submit |
| TC-API-FRM-009 | GET | `/responses/all` | All responses |
| TC-API-FRM-010 | GET/DELETE | `/:id/responses` | Form responses list |
| TC-API-FRM-011 | GET | `/:id/responses/export` | Export responses |
| TC-API-FRM-012 | GET/DELETE | `/:id/responses/:responseId` | Single response |
| TC-API-FRM-013 | PATCH | `/:id/responses/:responseId/status` | Status change |
| TC-API-FRM-014 | POST/PATCH | `/:id/responses/:responseId/corrective-action` | Corrective action |
| TC-API-FRM-015 | POST | `/:id/responses/:responseId/verify` | Auditor verify |
| TC-API-FRM-016 | POST | `/:id/responses/:responseId/approve` | Approve response |
| TC-API-FRM-017 | POST | `/:id/responses/:responseId/reject` | Reject response |
| TC-API-FRM-018 | POST | `/:id/responses/:responseId/archive` | Archive |
| TC-API-FRM-019 | POST | `/:id/responses/:responseId/invalidate` | Invalidate |
| TC-API-FRM-020 | POST | `/:id/responses/:responseId/restore` | Restore |
| TC-API-FRM-021 | GET | `/:id/responses/:responseId/compare` | Compare versions |
| TC-API-FRM-022 | POST | `/:id/responses/:responseId/generate-report` | PDF report |
| TC-API-FRM-023 | POST | `/:id/responses/:responseId/generate-comprehensive-report` | Full report |
| TC-API-FRM-024 | POST | `/:id/responses/:responseId/export-excel` | Excel export |
| TC-API-FRM-025 | GET | `/organization/:organizationId/audits` | Audit forms list |

#### Response detail (`/api/responses`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-RSP-001 | GET | `/:responseId` | Read-only response detail |

---

### 2.10 Helpdesk Cases — `/api/helpdesk/cases`

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-CASE-001 | GET/POST | `/` | List/create case |
| TC-API-CASE-002 | GET/PUT/DELETE | `/:id` | CRUD |
| TC-API-CASE-003 | PATCH | `/:id/status` | Status transition |
| TC-API-CASE-004 | POST | `/:id/reopen` | Reopen closed case |
| TC-API-CASE-005 | POST | `/:id/activities` | Add activity |
| TC-API-CASE-006 | PATCH | `/bulk/update` | Bulk update |
| TC-API-CASE-007 | POST | `/ingest/channel` | Channel ingest |
| TC-API-CASE-008 | GET | `/canned-responses` | Canned responses list |
| TC-API-CASE-009 | GET | `/analytics/summary` | Analytics summary |
| TC-API-CASE-010 | GET | `/analytics/trends` | Trend data |
| TC-API-CASE-011 | GET | `/analytics/owners` | Owner metrics |
| TC-API-CASE-012 | GET | `/analytics/distribution` | Distribution |
| TC-API-CASE-013 | GET | `/analytics/audit-export` | Audit export |
| TC-API-CASE-014 | GET/POST | `/:id/chat/session` | Live chat session |
| TC-API-CASE-015 | GET/POST | `/:id/chat/messages` | Chat messages |
| TC-API-CASE-016 | GET | `/:id/chat/stream` | Chat SSE stream |
| TC-API-CASE-017 | POST | `/:id/chat/read` | Mark read |
| TC-API-CASE-018 | POST | `/:id/chat/typing` | Typing indicator |

---

### 2.11 Communications, Mailboxes, Inbox, Mailroom

#### Communications (`/api/communications`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-COM-001 | GET | `/inbox/stream` | SSE inbox stream (token) |
| TC-API-COM-002 | GET | `/email/compose-preview` | Compose preview |
| TC-API-COM-003 | GET | `/email/reply-to-preview` | Reply-to preview |
| TC-API-COM-004 | POST | `/email` | Send outbound email |
| TC-API-COM-005 | GET | `/pipeline-metrics` | Pipeline metrics |
| TC-API-COM-006 | GET | `/pipeline-diagnostics` | Diagnostics |
| TC-API-COM-007 | GET | `/inbound/diagnostics` | Inbound diagnostics |
| TC-API-COM-008 | GET | `/inbound/dead-letter` | Dead letter queue |
| TC-API-COM-009 | POST | `/inbound/dead-letter/:id/replay` | Replay dead letter |
| TC-API-COM-010 | GET | `/suppressions/stats` | Suppression stats |
| TC-API-COM-011 | GET/DELETE | `/suppressions/:email` | Manage suppressions |
| TC-API-COM-012 | GET/POST | `/webhook-test/*` | Webhook simulation |
| TC-API-COM-013 | GET | `/threads` | Thread list |
| TC-API-COM-014 | GET | `/threads/:threadId/messages` | Thread messages |
| TC-API-COM-015 | GET | `/workspace-threads` | Workspace threads |
| TC-API-COM-016 | GET | `/workspace-thread-ids` | Thread IDs |
| TC-API-COM-017 | GET | `/workspace-thread-counts` | Counts |
| TC-API-COM-018 | GET | `/templates` | Email templates |
| TC-API-COM-019 | PATCH | `/threads/bulk` | Bulk thread actions |
| TC-API-COM-020 | PATCH | `/threads/:threadId/view` | Mark viewed |
| TC-API-COM-021 | PATCH | `/threads/:threadId/done` | Mark done |
| TC-API-COM-022 | PATCH | `/threads/:threadId/snooze` | Snooze thread |
| TC-API-COM-023 | PATCH | `/threads/:threadId/assign` | Assign owner |
| TC-API-COM-024 | PATCH | `/threads/:threadId/tags` | Thread tags |
| TC-API-COM-025 | POST | `/:communicationId/create-task` | Create task from email |
| TC-API-COM-026 | POST | `/:communicationId/create-case` | Create case from email |
| TC-API-COM-027 | GET | `/attachments/download` | Download attachment |
| TC-API-COM-028 | POST | `/upload`, `/upload-oci` | Upload attachment |

#### Mailboxes (`/api/mailboxes`)

| ID | Scenario |
|----|----------|
| TC-API-BOX-001 | CRUD mailbox |
| TC-API-BOX-002 | Gmail OAuth start + callback |
| TC-API-BOX-003 | Inbox sync run |
| TC-API-BOX-004 | Inbound parser provision |
| TC-API-BOX-005 | Outbound Gmail SMTP send |

#### Inbox (`/api/inbox`)

| ID | Scenario |
|----|----------|
| TC-API-INBOX-001 | GET `/` unified inbox aggregation |

#### Mailroom (`/api/mailroom`)

| ID | Scenario |
|----|----------|
| TC-API-MRM-001 | GET attachment download |
| TC-API-MRM-002 | POST chat ingest |

---

### 2.12 Platform APIs

#### UI Composition (`/api/ui`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-UI-001 | GET | `/registry` | Full bootstrap payload |
| TC-API-UI-002 | GET | `/apps` | Enabled apps |
| TC-API-UI-003 | GET | `/sidebar` | Navigation tree |
| TC-API-UI-004 | GET | `/routes` | Dynamic route definitions |
| TC-API-UI-005 | GET | `/apps/:appKey/modules` | Module list per app |
| TC-API-UI-006 | GET | `/entities` | Entity registry |
| TC-API-UI-007 | GET | `/projection/:appKey/:moduleKey` | Create-form projection |
| TC-API-UI-008 | GET | `/app-definitions` | App definitions |

#### Config Registry (`/api/config-registry`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-CFG-001 | GET | `/entity-types/:entity` | Entity types |
| TC-API-CFG-002 | GET | `/lifecycles/:entityTypeKey` | Lifecycles |
| TC-API-CFG-003 | GET | `/lifecycle-status-mappings/:lifecycleKey` | Status mappings |
| TC-API-CFG-004 | GET | `/pipelines` | Pipelines |
| TC-API-CFG-005 | GET | `/pipelines/:pipelineKey/stages` | Pipeline stages |
| TC-API-CFG-006 | POST | `/compute-derived-status` | Derived status compute |
| TC-API-CFG-007 | GET | `/configuration/:entity` | Entity configuration |
| TC-API-CFG-008 | GET | `/configuration` | Full configuration |

#### Settings (`/api/settings`) — all sub-routes

| ID | Area | Scenario |
|----|------|----------|
| TC-API-SET-001 | Core modules | GET/PATCH core module configs |
| TC-API-SET-002 | Organizations status types | GET/PATCH/PUT status types |
| TC-API-SET-003 | People types | GET/PUT people-types |
| TC-API-SET-004 | Applications | GET apps list + per-app config |
| TC-API-SET-005 | Quotes settings | GET/PUT quote defaults |
| TC-API-SET-006 | Assignment rules | CRUD assignment rules |
| TC-API-SET-007 | Subscriptions | GET/PUT subscription settings |
| TC-API-SET-008 | Organization settings | CRUD + logo upload |
| TC-API-SET-009 | Security | GET/PUT security settings + activity log |
| TC-API-SET-010 | Integrations | GET/POST/PUT integration configs |
| TC-API-SET-011 | Helpdesk execution | GET/PUT SLA settings |
| TC-API-SET-012 | Helpdesk recalculate SLAs | POST recalculate |
| TC-API-SET-013 | Mailroom automation | GET/PUT rules, templates, evaluate |
| TC-API-SET-014 | Mailroom observability | conversations, failures, metrics, replay |
| TC-API-SET-015 | Mailroom search | GET search |

#### Relationships (`/api/relationships`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-REL-001 | POST | `/link` | Create link |
| TC-API-REL-002 | POST | `/unlink` | Remove link |
| TC-API-REL-003 | GET | `/links` | List links |
| TC-API-REL-004 | GET | `/linkable-targets` | Picker targets |
| TC-API-REL-005 | GET | `/record-context` | Record page widgets |

#### Unified Module Records (`/api/modules`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-MOD-001 | GET | `/people/quick-create` | Quick-create metadata |
| TC-API-MOD-002 | GET/POST/DELETE/PUT | `/` | Module definitions CRUD |
| TC-API-MOD-003 | PUT | `/system/:key` | System module update |
| TC-API-MOD-004 | POST | `/:moduleKey/records/batch` | Bulk fetch |
| TC-API-MOD-005 | GET | `/:moduleKey/records/:recordId/activity` | Activity feed |
| TC-API-MOD-006 | GET/POST/PUT | `/:moduleKey/records/:recordId/comments` | Comments |
| TC-API-MOD-007 | POST | `/:moduleKey/records/:recordId/comment-attachments` | Attachments |
| TC-API-MOD-008 | POST | `/:moduleKey/records/:recordId/comments/:commentId/reactions` | Reactions |
| TC-API-MOD-009 | POST | `/:moduleKey/tags/delete` | Bulk tag delete |
| TC-API-MOD-010 | GET | `/:moduleKey/records/:recordId/neighbors` | Prev/next nav |
| TC-API-MOD-011 | GET/POST | `/:moduleKey/records/:recordId/description-versions` | Description versions |

#### Trash (`/api/trash`)

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-TRSH-001 | GET | `/stats` | Trash stats |
| TC-API-TRSH-002 | GET | `/` | List trashed records |
| TC-API-TRSH-003 | POST | `/:moduleKey/:recordId/restore` | Restore |
| TC-API-TRSH-004 | DELETE | `/:moduleKey/:recordId` | Permanent purge |
| TC-API-TRSH-005 | POST | `/:moduleKey/:recordId` | Verify trash entry exists |

#### Search, Activity, Execution, Reports, Targets

| ID | Prefix | Scenario |
|----|--------|----------|
| TC-API-SRCH-001 | `/api/search` | Global search query |
| TC-API-ACT-001 | `/api/activity/:entityType/:entityId` | Entity activity |
| TC-API-EXEC-001 | `/api/execution/execute` | Execute action |
| TC-API-RPT-001–005 | `/api/reports` | CRUD + run + export |
| TC-API-TGT-001–018 | `/api/targets` | Types, CRUD, activate/lock/complete/close, assignments, contributions, forecast, versions, redistribute, recalculate, leaderboard, platform-settings, conflicts |

#### CSV Import/Export (`/api/csv`, `/api/imports`)

| ID | Scenario |
|----|----------|
| TC-API-CSV-001 | POST `/parse` — parse uploaded CSV |
| TC-API-CSV-002 | POST `/staging` — stage rows |
| TC-API-CSV-003 | POST `/check-duplicates/{contacts,people,deals,tasks,organizations}` |
| TC-API-CSV-004 | POST `/import/{contacts,people,deals,tasks,organizations}` — queue/import |
| TC-API-CSV-005 | GET `/export/{contacts,people,deals,tasks,organizations}` |
| TC-API-IMP-001 | GET `/imports` — list jobs |
| TC-API-IMP-002 | GET `/imports/stats/summary` |
| TC-API-IMP-003 | GET `/imports/:id` — job detail |
| TC-API-IMP-004 | GET `/imports/:id/records/:type` — imported rows |
| TC-API-IMP-005 | DELETE `/imports/:id` — cancel/delete job |

#### Notes & Files

| ID | Prefix | Scenario |
|----|--------|----------|
| TC-API-NOTE-001 | `/api/notes/:entityType/:entityId` | GET/POST notes |
| TC-API-FILE-001 | `/api/files/:entityType/:entityId` | GET/POST files |
| TC-API-FILE-002 | `/api/files/download` | Download (optional auth) |
| TC-API-UPL-001 | `/api/upload` | POST multipart upload |

#### Business Hours (`/api/business-hours`)

| ID | Scenario |
|----|----------|
| TC-API-BH-001 | GET `/resolve` — resolve active hours |
| TC-API-BH-002 | CRUD `/sets` — business hour sets |
| TC-API-BH-003 | POST `/simulate` — simulate datetime in hours |
| TC-API-BH-004 | GET/POST `/kpis` — daily KPIs |
| TC-API-BH-005 | CRUD `/holiday-calendars` + import |

#### Scheduling (`/api/scheduling`)

| ID | Scenario |
|----|----------|
| TC-API-SCH-001 | GET/POST `/` — list/create schedules |
| TC-API-SCH-002 | GET `/:entityType/:entityId` — by entity |
| TC-API-SCH-003 | GET/PUT/DELETE `/:id` |
| TC-API-SCH-004 | PATCH `/:id/status` |
| TC-API-SCH-005 | PATCH `/:id/reschedule` |

---

### 2.13 Appointments — `/api/appointments`

| ID | Scenario |
|----|----------|
| TC-API-APT-001 | GET/PUT `/config/me` — user booking config |
| TC-API-APT-002 | GET `/config/pages` — booking pages list |
| TC-API-APT-003 | GET `/config/slug-available` — slug check |
| TC-API-APT-004 | GET/PUT `/config/user/:userId` |
| TC-API-APT-005 | GET/PUT `/config` — org config |
| TC-API-APT-006 | Google calendar connect start + callback |
| TC-API-APT-007 | Microsoft calendar connect start + callback |
| TC-API-APT-008 | DELETE calendar disconnect |
| TC-API-APT-009 | CRUD `/config/team*` — team booking pages |
| TC-API-APT-010 | GET `/stats` |
| TC-API-APT-011 | GET/POST `/events/:id/*` — guest-link, reschedule, cancel, complete, no-show |

---

### 2.14 Notifications & Push

| ID | Prefix | Scenario |
|----|--------|----------|
| TC-API-NOT-001 | `/api/notifications/stream` | SSE notification stream |
| TC-API-NOT-002 | `/api/notifications/` | List notifications |
| TC-API-NOT-003 | `/api/notifications/:id/read` | Mark read |
| TC-API-NOT-004 | `/api/notifications/read-all` | Mark all read |
| TC-API-NOT-005 | `/api/notifications/dev/simulate*` | Dev simulate (non-prod) |
| TC-API-NOT-006 | `/api/notification-preferences` | GET/PUT prefs |
| TC-API-NOT-007 | `/api/notification-rules` | CRUD + toggle rules |
| TC-API-PUSH-001 | `/api/push/public-key` | VAPID key (public) |
| TC-API-PUSH-002 | `/api/push/subscribe` | Web push subscribe |
| TC-API-PUSH-003 | `/api/push/unsubscribe` | Unsubscribe |

---

### 2.15 Audit App — `/api/audit/*`

| ID | Prefix | Scenario |
|----|--------|----------|
| TC-API-AUD-001 | `/api/audit/me` | Current auditor profile |
| TC-API-AUD-002 | `/api/audit/org` | Audit org context |
| TC-API-AUD-003 | `/api/audit/health` | Audit app health |
| TC-API-AUD-004 | `/api/audit/findings` | Findings list |
| TC-API-AUD-005 | `/api/audit/responses` | Responses list |
| TC-API-AUD-006 | `/api/audit/linked-events/:eventId` | Linked events |
| TC-API-AUD-007 | `/api/audit/forms/:formId` | Form for audit |
| TC-API-AUD-008 | `/api/audit/forms/:formId/responses/:responseId` | Response detail |
| TC-API-AUD-009 | POST approve/reject response | Approval workflow |
| TC-API-AUD-010 | POST `/forms/:formId/submit` | Submit form |
| TC-API-AUD-011 | `/api/audit/organizations` | Audit org list |
| TC-API-AUD-012 | PUT `/organizations/:id/address` | Update address |
| TC-API-AUD-013 | POST `/events` | Create audit event |
| TC-API-AUD-014 | POST `/execute/:eventId/check-in` | Check-in |
| TC-API-AUD-015 | POST `/execute/:eventId/submit` | Submit audit |
| TC-API-AUD-016 | POST `/execute/:eventId/approve` | Approve |
| TC-API-AUD-017 | POST `/execute/:eventId/reject` | Reject |
| TC-API-AUD-018 | GET `/assignments/` | Assignment list |
| TC-API-AUD-019 | GET `/assignments/:eventId` | Assignment detail |
| TC-API-AUD-020 | GET `/assignments/:eventId/timeline` | Timeline |
| TC-API-AUD-021 | GET `/assignments/:eventId/execution-status` | Execution status |

---

### 2.16 Portal App — `/portal/*`

| ID | Method | Path | Scenario |
|----|--------|------|----------|
| TC-API-PRT-001 | GET | `/me` | Portal user profile |
| TC-API-PRT-002 | GET | `/org` | Portal org |
| TC-API-PRT-003 | GET | `/health` | Health |
| TC-API-PRT-004 | GET | `/audits` | Assigned audits |
| TC-API-PRT-005 | GET | `/audits/:eventId` | Audit detail |
| TC-API-PRT-006 | GET | `/actions` | Corrective actions |
| TC-API-PRT-007 | POST | `/actions/:actionId/evidence` | Upload evidence |
| TC-API-PRT-008 | GET/POST | `/cases` | Support cases |
| TC-API-PRT-009 | GET | `/cases/:id` | Case detail |
| TC-API-PRT-010 | POST | `/cases/:id/reply` | Reply to case |
| TC-API-PRT-011 | POST | `/mailroom/ingest` | Inbound mail |
| TC-API-PRT-012 | POST | `/mailroom/cases/:caseId/reply` | Mailroom reply |
| TC-API-PRT-013 | POST | `/mailroom/attachments` | Upload attachment |
| TC-API-PRT-014 | GET | `/mailroom/conversations/:conversationId/attachments` | List attachments |
| TC-API-PRT-015 | GET | `/mailroom/messages/:messageId/attachments` | Message attachments |
| TC-API-PRT-016 | GET | `/mailroom/attachments/:id/download` | Download |

---

### 2.17 Admin & Control Plane

| ID | Prefix | Scenario |
|----|--------|----------|
| TC-API-ADM-001 | `/api/admin/contacts/*` | Cross-org contact admin |
| TC-API-ADM-002 | `/api/admin/organizations/*` | Cross-org org admin |
| TC-API-ADM-003 | `/api/admin/automation-rules` | CRUD + toggle + preview |
| TC-API-ADM-004 | `/api/admin/processes` | CRUD + designer + test + executions |
| TC-API-ADM-005 | `/api/admin/approvals` + `/api/approvals` | Approval inbox + decide |
| TC-API-ADM-006 | `/api/admin/business-flows` | CRUD + health/metrics/bottlenecks |
| TC-API-ADM-007 | `/api/admin/business-flow-templates` | List/import templates |
| TC-API-ADM-008 | `/api/automation/context` | Automation context (read-only) |
| TC-API-ADM-009 | `/api/automation/app-flows` | App flow visibility |
| TC-API-ADM-010 | `/api/automation/batch-check` | Batch automation check |
| TC-API-ADM-011 | `/api/admin/notifications/*` | Notification analytics |
| TC-API-ADM-012 | `/api/demo/request` | Public demo request |
| TC-API-ADM-013 | `/api/demo/requests/*` | Admin demo management |
| TC-API-ADM-014 | `/api/instances/*` | Instance lifecycle |
| TC-API-ADM-015 | `/api/metrics/*` | Metrics aggregation |
| TC-API-ADM-016 | `/api/digest/trigger/daily\|weekly` | Manual digest trigger |
| TC-API-ADM-017 | `/api/platform/inbound-parser` | Parser config (platform admin) |

---

### 2.18 Public & Webhook APIs

#### Public surfaces

| ID | Path | Scenario |
|----|------|----------|
| TC-PUB-FRM-001 | GET `/api/public/forms/:slug` | Load public form |
| TC-PUB-FRM-002 | POST `/api/public/forms/:slug/submit` | Submit response |
| TC-PUB-FRM-003 | Invalid slug | 404 |
| TC-PUB-BOOK-001 | GET `/api/public/book/:slug` | Booking page config |
| TC-PUB-BOOK-002 | GET `/api/public/book/:slug/slots` | Available slots |
| TC-PUB-BOOK-003 | POST `/api/public/book/:slug/book` | Book appointment |
| TC-PUB-APT-001 | GET `/api/public/appointments/manage/:token` | Manage page |
| TC-PUB-APT-002 | GET `.../slots` | Reschedule slots |
| TC-PUB-APT-003 | POST `.../reschedule` | Reschedule |
| TC-PUB-APT-004 | POST `.../cancel` | Cancel |
| TC-PUB-APT-005 | Expired/invalid token | 404 |
| TC-PUB-QTE-001 | GET `/api/public/quotes/:token/view` | View quote |
| TC-PUB-QTE-002 | GET `.../pdf` | Download PDF |
| TC-PUB-QTE-003 | POST `.../accept` | Accept quote |
| TC-PUB-QTE-004 | POST `.../reject` | Reject quote |
| TC-PUB-QTE-005 | GET/POST `.../comments` | Portal comments |
| TC-PUB-QTE-006 | Revoked token | 404 |
| TC-PUB-QTE-007 | Rate limit exceeded | 429 |
| TC-PUB-MRM-001 | POST `/api/public/mailroom/ingest` | Inbound with Bearer key |
| TC-PUB-MRM-002 | Append message + attachments | Thread continuity |
| TC-PUB-MRM-003 | Invalid ingest key | 401 |
| TC-PUB-CHAT-001 | GET `/embed/chat/config` | Widget config |
| TC-PUB-CHAT-002 | POST `/embed/chat/sessions` | Create session |
| TC-PUB-CHAT-003 | GET/POST messages | Message exchange |
| TC-PUB-CHAT-004 | GET stream SSE | Real-time messages |
| TC-PUB-CHAT-005 | POST typing + receipts | Presence |
| TC-PUB-CHAT-006 | POST close session | End chat |
| TC-PUB-CHAT-007 | Invalid instance key | 401 |

#### Webhooks

| ID | Path | Scenario |
|----|------|----------|
| TC-PUB-WH-001 | POST `/api/webhooks/arivu/inbound-email` | HMAC-valid inbound |
| TC-PUB-WH-002 | POST same — invalid HMAC | 401 |
| TC-PUB-WH-003 | POST `/api/webhooks/email/inbound` | MIME inbound |
| TC-PUB-WH-004 | POST `/api/webhooks/email/ses-events` | SES bounce/complaint |
| TC-PUB-WH-005 | POST `/api/webhooks/email/events` | Provider events |
| TC-PUB-WH-006 | POST `/api/webhooks/email/gmail/push` | Gmail push notification |
| TC-PUB-WH-007 | POST `/api/hooks/process/:webhookKey` | Process webhook trigger |
| TC-PUB-WH-008 | Invalid webhook key | 401 |

---

## 3. E2E Business Flows

Cross-module journeys. Each flow = ordered API + UI steps with assertions on side effects (DB, notifications, SSE, queues).

### 3.1 Platform Bootstrap

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-BOOT-001 | Cold start session | Login → GET registry/sidebar/routes → dynamic routes registered | All entitled modules in sidebar |
| TC-E2E-BOOT-002 | App switcher | Enable SALES+HELPDESK → switch apps in shell | Correct sidebar per app |
| TC-E2E-BOOT-003 | Terminated instance | Login on terminated tenant | Blocked at `/platform/home` |
| TC-E2E-BOOT-004 | Profile refresh | Login → change role permissions → profile refresh | New permissions without re-login |

### 3.2 SALES — Lead to Revenue

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-SLS-001 | Lead intake | Create person (Lead) → assign owner → tag | participations.SALES.lead_status |
| TC-E2E-SLS-002 | Lead qualification | Update lead score → activity log | Activity entry |
| TC-E2E-SLS-003 | Lead → Contact | POST convert-lead-to-contact | Role=Contact; lifecycle event |
| TC-E2E-SLS-004 | Contact → Account | Link person to company account | Relationship instance |
| TC-E2E-SLS-005 | Account → Deal | Create deal linked to person + account | dealPeople, dealOrganizations |
| TC-E2E-SLS-006 | Pipeline progression | PATCH stage through pipeline → Won | Stage history; probability |
| TC-E2E-SLS-007 | Deal lost | Move to Lost stage | Status + activity |
| TC-E2E-SLS-008 | Task from deal | Create related task from deal record | relatedTo link |
| TC-E2E-SLS-009 | Meeting from deal | Create event linked to deal | Event on calendar |
| TC-E2E-SLS-010 | Assignment rule | Configure rule → create unassigned lead → auto-assign | PEOPLE_ASSIGNED notification |
| TC-E2E-SLS-011 | Business flow template | Import sales-lifecycle template → trigger stage | Flow metrics update |

### 3.3 SALES — CPQ Quote Lifecycle

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-QTE-001 | Quote creation | Create quote → add sections/lines from catalog | Totals correct |
| TC-E2E-QTE-002 | Discount + recalc | Apply discount → recalculate | Line + header totals |
| TC-E2E-QTE-003 | Approval gate | Submit → pending (locked) → approve | Status Approved |
| TC-E2E-QTE-004 | Rejection path | Submit → reject → revise | New revision unlocked |
| TC-E2E-QTE-005 | Share + public accept | Share token → public view → accept | Status Accepted; activity |
| TC-E2E-QTE-006 | Public reject | Share → reject with reason | Status Rejected |
| TC-E2E-QTE-007 | PDF generation | Generate document → download | PDF valid |
| TC-E2E-QTE-008 | Convert to deal | Approved quote → convert | Deal created; conversion link |
| TC-E2E-QTE-009 | Quote expiry cron | Set expiry → run scheduler | Status Expired |
| TC-E2E-QTE-010 | Process approval | High-value quote → process engine approval | ApprovalInstance resolved |

### 3.4 SALES — Catalog & Items

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-CAT-001 | Item + variant | Create item → add variant → price book entry | Search finds variant |
| TC-E2E-CAT-002 | Bundle | Configure bundle components → expand | Correct component prices |
| TC-E2E-CAT-003 | Category tree | Create category → assign attributes → assign item | Filter by category |
| TC-E2E-CAT-004 | Media gallery | Upload images → reorder → delete | Gallery state |
| TC-E2E-CAT-005 | Low stock | Reduce stock below threshold | Appears in low-stock |
| TC-E2E-CAT-006 | Link item to deal | link-deal from item record | Relationship visible |

### 3.5 SALES — Forms & Responses

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-FRM-001 | Form builder | Create form → sections/questions → save | Builder persists |
| TC-E2E-FRM-002 | Public publish | enable-public → submit via public slug | Response created |
| TC-E2E-FRM-003 | Internal fill | Authenticated fill → submit | Response linked |
| TC-E2E-FRM-004 | Scoring/KPI | Submit scored form → analytics | KPI computed |
| TC-E2E-FRM-005 | Corrective action | Response → add corrective action → verify | Status transitions |
| TC-E2E-FRM-006 | Approve/reject response | Reviewer approve/reject | Immutable after submit |
| TC-E2E-FRM-007 | Link to event | link-event → submit during event execution | Audit linkage |
| TC-E2E-FRM-008 | Export | Export responses Excel + PDF report | Files downloadable |
| TC-E2E-FRM-009 | Archive/invalidate | Archive submitted response | Hidden from active list |

### 3.6 SALES — Import/Export

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-IMP-001 | People import | Upload CSV → map → check duplicates → import | ImportHistory success; rows in org |
| TC-E2E-IMP-002 | Deals import | Same flow for deals | Deals with correct stages |
| TC-E2E-IMP-003 | Duplicate skip | Import with duplicate emails | Skipped count in job |
| TC-E2E-IMP-004 | Failed import rollback | Invalid rows mid-batch | Job status failed; no partial corrupt |
| TC-E2E-IMP-005 | Export round-trip | Export people → re-import | Data parity |
| TC-E2E-IMP-006 | Bull queue path | Import with Redis running | Job processed by worker |
| TC-E2E-IMP-007 | Inline fallback | Import without Redis | Inline processing completes |

### 3.7 SALES — Communications & Inbox

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-COM-001 | Connect mailbox | Add mailbox → Gmail OAuth → sync | Threads appear |
| TC-E2E-COM-002 | Send email | Compose → send → thread created | Outbound in sent |
| TC-E2E-COM-003 | Reply thread | Reply to thread → mark viewed | Thread updated |
| TC-E2E-COM-004 | Snooze + wake | Snooze thread → scheduler fires | EMAIL_THREAD_SNOOZE_ENDED notification |
| TC-E2E-COM-005 | Create task from email | POST create-task | Task with relatedTo |
| TC-E2E-COM-006 | Create case from email | POST create-case | Case with email link |
| TC-E2E-COM-007 | Inbox SSE | Connect SSE → send email → event received | Real-time update |
| TC-E2E-COM-008 | Suppression | Bounce → suppression list → block resend | Suppression enforced |
| TC-E2E-COM-009 | Attachment upload OCI | Upload via communications | Download works |

### 3.8 HELPDESK — Case Lifecycle

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-HD-001 | Manual case create | Create case → assign → priority | CASE_CREATED notification |
| TC-E2E-HD-002 | Email → case | Inbound email via mailroom/webhook | Case auto-created; threaded |
| TC-E2E-HD-003 | Agent reply | Reply with canned response merge tags | Activity + email sent |
| TC-E2E-HD-004 | Status transitions | Open → Pending → Resolved → Closed | CASE_STATUS_CHANGED events |
| TC-E2E-HD-005 | Reopen | Closed → reopen | CASE_REOPENED |
| TC-E2E-HD-006 | SLA warning | Advance clocks → warning threshold | SLA_WARNING once per cycle |
| TC-E2E-HD-007 | SLA breach | Pass resolution deadline | SLA_BREACHED + escalation |
| TC-E2E-HD-008 | SLA pause | Pause segment in business hours off | Clock paused |
| TC-E2E-HD-009 | Assignment rule | Rule matches → auto-assign | CASE_ASSIGNED |
| TC-E2E-HD-010 | Bulk update | PATCH bulk status/priority | All cases updated |
| TC-E2E-HD-011 | Analytics | Seed cases → summary/trends/owners | Non-zero metrics |
| TC-E2E-HD-012 | Live chat | Embed chat → case linked → agent sees messages | CASE_CHAT_MESSAGE_RECEIVED |
| TC-E2E-HD-013 | Channel ingest | POST ingest/channel | Case from portal/chat channel |

### 3.9 HELPDESK — Mailroom Pipeline

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-MRM-001 | Inbound parse | Webhook MIME → mailroom → case adapter | Conversation + case |
| TC-E2E-MRM-002 | Thread dedup | Same thread second message | Appended not duplicated |
| TC-E2E-MRM-003 | Policy evaluate | Settings evaluate endpoint | Routing decision logged |
| TC-E2E-MRM-004 | Failure + replay | Simulated failure → replay | Message reprocessed |
| TC-E2E-MRM-005 | Public ingest | Bearer key ingest from external system | Conversation created |
| TC-E2E-MRM-006 | Attachment pipeline | Inbound with attachments → download | File accessible |

### 3.10 AUDIT — Execution Workflow

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-AUD-001 | Schedule audit | Create Internal Audit event → assign auditor | AUDIT_ASSIGNED |
| TC-E2E-AUD-002 | Schedule beat | Plan audit beat multi-org route | Events chain |
| TC-E2E-AUD-003 | Check-in | POST execute check-in (geo if required) | AUDIT_CHECKED_IN; state checked_in |
| TC-E2E-AUD-004 | Fill + submit | Complete form during execution → submit | AUDIT_SUBMITTED; needs_review |
| TC-E2E-AUD-005 | Corrective actions | Findings → corrective action → due dates | CORRECTIVE_ACTION_* events |
| TC-E2E-AUD-006 | Approve audit | Reviewer approve | AUDIT_APPROVED; closed |
| TC-E2E-AUD-007 | Reject + rework | Reject → re-submit | AUDIT_REJECTED → resubmit |
| TC-E2E-AUD-008 | Timeline | Full flow → GET timeline | Ordered events |
| TC-E2E-AUD-009 | Offline sync | Audit app offline queue → reconnect sync | No data loss |
| TC-E2E-AUD-010 | Findings module | AUDIT context cases list | Scoped to audit app |

### 3.11 PORTAL — Customer Self-Service

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-PRT-001 | View assigned audits | Login portal → audits list | Only assigned |
| TC-E2E-PRT-002 | Audit detail | Open audit → read-only fields | No SALES data leak |
| TC-E2E-PRT-003 | Corrective action evidence | Upload evidence on action | EVIDENCE_UPLOADED |
| TC-E2E-PRT-004 | Support case create | POST case | Case in helpdesk |
| TC-E2E-PRT-005 | Case reply | Customer reply via portal | Agent sees in helpdesk |
| TC-E2E-PRT-006 | Mailroom reply | Reply via mailroom path | Thread continuity |
| TC-E2E-PRT-007 | Notification prefs | Update portal notification prefs | Prefs saved |

### 3.12 Appointments & Public Booking

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-APT-001 | Configure booking page | Set availability → publish slug | Public page loads |
| TC-E2E-APT-002 | Public book | Select slot → book | Appointment event created |
| TC-E2E-APT-003 | Calendar sync | Google OAuth → sync busy times | Slots exclude busy |
| TC-E2E-APT-004 | Team booking | Team page → round-robin assign | Correct assignee |
| TC-E2E-APT-005 | Reschedule | Public manage token → reschedule | Updated time |
| TC-E2E-APT-006 | Cancel | Public manage → cancel | Status cancelled |
| TC-E2E-APT-007 | Reminder cron | Book → advance time → reminder job | Notification sent |
| TC-E2E-APT-008 | No-show / complete | Mark no-show or complete | Status updated |

### 3.13 Automation, Processes & Approvals

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-AUTO-001 | Automation rule | Create rule on CASE_CREATED → field update | Side effect on create |
| TC-E2E-AUTO-002 | Rule toggle off | Disable rule → trigger event | No side effect |
| TC-E2E-AUTO-003 | Rule preview | POST preview with sample payload | Preview result |
| TC-E2E-AUTO-004 | Process designer | Create process → test → webhook trigger | Execution graph state |
| TC-E2E-AUTO-005 | Process wait resume | Process wait node → cron resume | Continues execution |
| TC-E2E-AUTO-006 | Approval inbox | Submit for approval → approve in inbox | Record unlocked |
| TC-E2E-AUTO-007 | Approval reject | Reject with comment | Record returned |
| TC-E2E-AUTO-008 | Business flow health | Run flow → check health/metrics | Bottleneck detection |
| TC-E2E-AUTO-009 | Deferred automation | Off-hours trigger → deferred row → cron | Executes in hours |
| TC-E2E-AUTO-010 | Notification rule match | User rule on domain event → deliver | In-app + email per prefs |

### 3.14 Targets & Performance

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-TGT-001 | Create target | Wizard → assign users → activate | Target active |
| TC-E2E-TGT-002 | Contribution | Deal won → contribution ledger | Progress updated |
| TC-E2E-TGT-003 | Recalculate cron | Run TARGET_RECALC | Totals refreshed |
| TC-E2E-TGT-004 | Lock/complete/close | Lifecycle transitions | Status enforced |
| TC-E2E-TGT-005 | Leaderboard | Multiple contributors → GET leaderboard | Rankings correct |
| TC-E2E-TGT-006 | Conflict check | Overlapping targets → check | Conflict reported |

### 3.15 Trash & Data Integrity

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-TRSH-001 | Soft delete | DELETE person/deal/case/task/event/item/org/quote | deletedAt set; in trash |
| TC-E2E-TRSH-002 | Dependency block | Delete org with linked deals | blocked + dependencies |
| TC-E2E-TRSH-003 | Restore | Restore from trash | Record active |
| TC-E2E-TRSH-004 | Permanent purge | Purge from trash | Gone from DB |
| TC-E2E-TRSH-005 | Retention cron | Past retention → purge job | Expired snapshots removed |
| TC-E2E-TRSH-006 | Legal hold skip | Hold flag → retention cron | Not purged |

### 3.16 Control Plane & Demo

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-CP-001 | Demo request | Public POST demo → admin list | DemoRequest created |
| TC-E2E-CP-002 | Instance provision | Approve demo → instance ACTIVE | Dedicated DB if configured |
| TC-E2E-CP-003 | Instance suspend | PATCH status SUSPENDED | Tenant blocked |
| TC-E2E-CP-004 | Metrics collect | POST collect-all | Metrics aggregated |
| TC-E2E-CP-005 | Inbound parser config | Platform admin update parser | Test connection passes |
| TC-E2E-CP-006 | Digest trigger | POST daily digest | DIGEST_DAILY notifications |

### 3.17 Reports & Search

| ID | Flow | Steps | Assert |
|----|------|-------|--------|
| TC-E2E-RPT-001 | Saved report | Create report → run → export | Data matches filters |
| TC-E2E-SRCH-001 | Global search | Cmd+K search person/deal/case | Results tenant-scoped |
| TC-E2E-SRCH-002 | Command palette | Cmd+/ create person drawer | Record created |

---

## 4. UI Automation — By Surface

Use Playwright/Cypress. Account for: dynamic routes, multi-tab shell (`useTabs`), SSE streams, i18n labels, permission-hidden elements.

### 4.1 Public Pages

| ID | Route | Scenarios |
|----|-------|-----------|
| TC-UI-PUB-001 | `/login` | Valid/invalid login; redirect; remember route |
| TC-UI-PUB-002 | `/demo` | Submit demo request form |
| TC-UI-PUB-003 | `/forms/public/:slug` | Render form; validation; submit success/error |
| TC-UI-PUB-004 | `/public/quotes/:token` | View; accept; reject; comments; PDF download |
| TC-UI-PUB-005 | `/book/:slug` | Slot picker; book; confirmation |
| TC-UI-PUB-006 | `/book/:slug/embed` | Embedded booking iframe |
| TC-UI-PUB-007 | `/appointments/manage/:token` | Reschedule; cancel; invalid token |
| TC-UI-PUB-008 | Embed chat widget | Open widget; send message; receive SSE |

### 4.2 Platform Shell

| ID | Route | Scenarios |
|----|-------|-----------|
| TC-UI-PLT-001 | `/platform/home` | App cards; attention items; quick links |
| TC-UI-PLT-002 | `/platform/apps` | App registry; enable/disable (admin) |
| TC-UI-PLT-003 | `/platform/attention` | Attention surface items |
| TC-UI-PLT-004 | `/inbox` | Empty state; connect mailbox; thread list/read/reply/compose |
| TC-UI-PLT-005 | `/approvals` | Pending list; empty state |
| TC-UI-PLT-006 | `/approvals/:id` | Approve/reject actions |
| TC-UI-PLT-007 | `/trash` | List; restore; permanent delete |
| TC-UI-PLT-008 | Sidebar | Collapse; app switch; module navigation |
| TC-UI-PLT-009 | Tab bar | Open record in tab; close tab; dirty guard |
| TC-UI-PLT-010 | Notifications bell | Unread count; mark read; SSE update |
| TC-UI-PLT-011 | Cmd+K search | Search records; navigate to result |
| TC-UI-PLT-012 | Cmd+/ palette | Create person/org/task/event commands |
| TC-UI-PLT-013 | Color mode | Light/dark toggle persists |

### 4.3 SALES Module Lists & Records

| ID | Route | Scenarios |
|----|-------|-----------|
| TC-UI-SLS-001 | `/sales/dashboard` | Widgets load; metrics non-error |
| TC-UI-SLS-002 | `/people` | List; filter; sort; bulk actions |
| TC-UI-SLS-003 | `/people/create` | Create lead/contact; validation |
| TC-UI-SLS-004 | `/people/:id` | Profile; participations; activity; link org |
| TC-UI-SLS-005 | `/organizations` | List; filters |
| TC-UI-SLS-006 | `/organizations/new` | Create company account |
| TC-UI-SLS-007 | `/organizations/:id` | Detail; related people/deals |
| TC-UI-SLS-008 | `/organizations/:id/edit` | Edit drawer/page |
| TC-UI-SLS-009 | `/deals` | Kanban view; drag stage; list view toggle |
| TC-UI-SLS-010 | `/deals/:id` | Deal record; stage history; related; comments |
| TC-UI-SLS-011 | `/tasks` | List; mark complete; filters |
| TC-UI-SLS-012 | `/tasks/:id` | Subtasks; comments; related record |
| TC-UI-SLS-013 | `/events` | Calendar/list; filters |
| TC-UI-SLS-014 | `/events/create` | Create meeting/audit/beat |
| TC-UI-SLS-015 | `/events/:id` | Event detail |
| TC-UI-SLS-016 | `/events/:id/execute` | Execution surface only |
| TC-UI-SLS-017 | `/items` | Catalog list |
| TC-UI-SLS-018 | `/items/:id` | Variants; media; pricing sections |
| TC-UI-SLS-019 | `/quotes` | List; create drawer |
| TC-UI-SLS-020 | `/quotes/new` | Full create flow |
| TC-UI-SLS-021 | `/quotes/:id` | Lines; sections; approval; share |
| TC-UI-SLS-022 | `/forms` | Forms hub |
| TC-UI-SLS-023 | `/forms/create` | Form creation wizard |
| TC-UI-SLS-024 | `/forms/builder/:id` | Drag-drop builder; save |
| TC-UI-SLS-025 | `/forms/:id/detail` | Form settings |
| TC-UI-SLS-026 | `/forms/:id/responses` | Response list |
| TC-UI-SLS-027 | `/forms/:id/responses/:responseId` | Response review |
| TC-UI-SLS-028 | `/forms/:id/fill` | Internal fill |
| TC-UI-SLS-029 | `/responses` | Global responses |
| TC-UI-SLS-030 | `/imports` | Import list |
| TC-UI-SLS-031 | `/imports/:id` | Import progress/detail |
| TC-UI-SLS-032 | `/groups` | Groups list |
| TC-UI-SLS-033 | `/groups/:id` | Members; activity |
| TC-UI-SLS-034 | `/targets/new` | Target wizard |
| TC-UI-SLS-035 | `/targets/:id` | Target progress |

### 4.4 HELPDESK UI

| ID | Route | Scenarios |
|----|-------|-----------|
| TC-UI-HD-001 | `/helpdesk/cases` | Case list; filters; analytics link |
| TC-UI-HD-002 | `/helpdesk/cases/new` | Create case drawer |
| TC-UI-HD-003 | `/helpdesk/cases/:id` | Email timeline; reply; canned responses; SLA badge |
| TC-UI-HD-004 | Case resolution dialog | Resolve with resolution code |
| TC-UI-HD-005 | Case live chat panel | Agent chat with embed session |
| TC-UI-HD-006 | Case participants | Add/remove participants |
| TC-UI-HD-007 | Side conversations | Side thread panel |

### 4.5 AUDIT UI

| ID | Route | Scenarios |
|----|-------|-----------|
| TC-UI-AUD-001 | `/audit/dashboard` | Stats; upcoming audits |
| TC-UI-AUD-002 | `/audit/schedule` | Schedule audit/beat |
| TC-UI-AUD-003 | `/audit/audits` | Audit list |
| TC-UI-AUD-004 | `/audit/audits/:eventId` | Execution detail |
| TC-UI-AUD-005 | `/audit/findings` | Findings list (GenericModule) |
| TC-UI-AUD-006 | `/audit/responses` | Response list |
| TC-UI-AUD-007 | `/audit/forms/:id/responses/:responseId` | Response detail |
| TC-UI-AUD-008 | Offline sync drawer | Queue when offline |
| TC-UI-AUD-009 | Audit-only user blocked from `/deals` | Redirect |

### 4.6 PORTAL UI

| ID | Route | Scenarios |
|----|-------|-----------|
| TC-UI-PRT-001 | `/portal/dashboard` | Summary cards |
| TC-UI-PRT-002 | `/portal/audits` | Audit list |
| TC-UI-PRT-003 | `/portal/audits/:eventId` | Audit detail |
| TC-UI-PRT-004 | `/portal/actions` | Corrective actions |
| TC-UI-PRT-005 | `/portal/cases` | Case list |
| TC-UI-PRT-006 | `/portal/cases/:id` | Case detail + reply |
| TC-UI-PRT-007 | `/portal/profile` | Profile edit |
| TC-UI-PRT-008 | Mobile bottom nav | Navigate all portal tabs |

### 4.7 Settings UI (every tab)

| ID | Tab / Route | Scenarios |
|----|-------------|-----------|
| TC-UI-SET-001 | `?tab=profile` | Edit profile; password; avatar |
| TC-UI-SET-002 | `?tab=organization` | Org name; logo; address |
| TC-UI-SET-003 | `?tab=business-hours` | Create set; holidays; simulate |
| TC-UI-SET-004 | `?tab=users-access` | Users CRUD; roles; groups |
| TC-UI-SET-005 | `?tab=core-modules&moduleKey=*` | Fields; layouts per module |
| TC-UI-SET-006 | `?tab=applications&app=sales` | Pipelines; schema; permissions |
| TC-UI-SET-007 | `?tab=applications&app=helpdesk` | Case schema; SLA; analytics |
| TC-UI-SET-008 | `?tab=applications&view=management` | Enable/disable apps |
| TC-UI-SET-009 | `?tab=automation&automationView=assignment-rules` | Assignment rules CRUD |
| TC-UI-SET-010 | `?tab=automation&automationView=mailroom` | Mailroom rules |
| TC-UI-SET-011 | `?tab=automation&automationView=catalog` | Catalog settings |
| TC-UI-SET-012 | `?tab=automation&automationView=quotes` | Quote settings |
| TC-UI-SET-013 | `/settings/automation/automation-rules` | Full-page rules |
| TC-UI-SET-014 | `/settings/automation/processes` | Process list |
| TC-UI-SET-015 | `/settings/automation/processes/new` | New process designer |
| TC-UI-SET-016 | `/settings/automation/processes/:id/design` | Edit process graph |
| TC-UI-SET-017 | `/settings/automation/flows` | Business flows list |
| TC-UI-SET-018 | `/settings/automation/flows/create` | Create flow |
| TC-UI-SET-019 | `/settings/automation/flows/:id/health` | Flow health dashboard |
| TC-UI-SET-020 | `?tab=performance&view=targets` | Targets management |
| TC-UI-SET-021 | `?tab=performance&view=dashboards` | Performance dashboards |
| TC-UI-SET-022 | `?tab=subscriptions` | Plan view; upgrade |
| TC-UI-SET-023 | `?tab=notifications&notificationPage=*` | Prefs; channels; rules; health |
| TC-UI-SET-024 | `?tab=security` | Security settings; activity log |
| TC-UI-SET-025 | `?tab=integrations&integrationView=*` | Email; calendar; webhooks |
| TC-UI-SET-026 | `?tab=demo-requests` | Demo list (master org dev) |
| TC-UI-SET-027 | `?tab=instances` | Instance management |
| TC-UI-SET-028 | Settings access gate | User without settings sees only entitled tabs |
| TC-UI-SET-029 | `/settings/notifications/overview` | Notification overview page |
| TC-UI-SET-030 | `/settings/notifications/rules` | Notification rules page |
| TC-UI-SET-031 | `/settings/notifications/health` | Admin health (admin only) |

### 4.8 Appointments UI

| ID | Route | Scenarios |
|----|-------|-----------|
| TC-UI-APT-001 | `/appointments/pages` | Booking pages list |
| TC-UI-APT-002 | `/appointments/configure` | Personal booking config |
| TC-UI-APT-003 | `/appointments/configure/user/:userId` | Admin configure user |
| TC-UI-APT-004 | `/appointments/team/configure` | New team page |
| TC-UI-APT-005 | `/appointments/team/configure/:id` | Edit team page |
| TC-UI-APT-006 | Calendar connect buttons | Google/Microsoft OAuth start |

### 4.9 Control Plane UI

| ID | Route | Scenarios |
|----|-------|-----------|
| TC-UI-CP-001 | `/control` | Control plane home |
| TC-UI-CP-002 | `/control/demo-requests` | Demo queue |
| TC-UI-CP-003 | `/control/instances` | Instance list/status |
| TC-UI-CP-004 | `/control/inbound-parser` | Parser configuration |

### 4.10 Record Page Interaction Matrix (all module types)

| Action | Test |
|--------|------|
| Open from list | Click row → tab opens with correct title |
| Edit field inline/drawer | Save → API PUT → UI reflects |
| System fields hidden | deletedAt/deletedBy never in create/edit |
| Custom fields | Render from tenant config; save in customFields |
| Comments | Add; edit; react; attach file |
| Activity tab | Shows field updates + comments merged |
| Relationships | Link via drawer; unlink; related pane |
| Neighbors | Prev/next record navigation |
| Delete | Confirm → trash; not hard delete |
| Duplicate | Creates copy (where supported) |
| Export CSV | Downloads file (where supported) |
| Tags | Add/remove tags |
| Permission denied | Action hidden or error toast |
| i18n | Labels from locale keys not hardcoded English |

### 4.11 Dynamic Registry Routes

| ID | Scenario |
|----|----------|
| TC-UI-DYN-001 | New module enabled server-side → appears in sidebar after refresh |
| TC-UI-DYN-002 | `{routeBase}` list renders GenericModule |
| TC-UI-DYN-003 | `{routeBase}/new` opens create drawer |
| TC-UI-DYN-004 | `{routeBase}/:id` opens ModuleRecordPage |
| TC-UI-DYN-005 | Disabled module → route not registered |
| TC-UI-DYN-006 | CONTROL_PLANE routes never injected for tenant |

---

## 5. Async & Background Job Testing

Master switch: `ENABLE_SCHEDULED_JOBS`. Worker process: `npm run worker` (Bull).

### 5.1 Bull Queues

| ID | Queue | Trigger | Assert |
|----|-------|---------|--------|
| TC-ASYNC-001 | email-send | POST `/api/communications/email` | Job completed; email delivered/mock |
| TC-ASYNC-002 | email-send retry | Simulated failure | Retry per policy |
| TC-ASYNC-003 | inbound-email | POST webhook | Mailroom/case processed |
| TC-ASYNC-004 | imports:csv:process | POST `/api/csv/import/*` | ImportHistory → complete |
| TC-ASYNC-005 | No Redis fallback | Import without Redis | Inline completion |

### 5.2 Cron Schedulers

| ID | Job | Env toggle | Assert |
|----|-----|------------|--------|
| TC-ASYNC-010 | Daily digest | ENABLE_DIGEST_SCHEDULER | DIGEST_DAILY sent |
| TC-ASYNC-011 | Weekly digest | same | DIGEST_WEEKLY sent |
| TC-ASYNC-012 | Escalation resolver | ENABLE_ESCALATION_SCHEDULER | Pending approvals escalated |
| TC-ASYNC-013 | Trash retention purge | ENABLE_TRASH_RETENTION_SCHEDULER | Expired trash purged |
| TC-ASYNC-014 | Assignment jobs | ENABLE_ASSIGNMENT_SCHEDULER | Deferred assignments run |
| TC-ASYNC-015 | Process wait resume | ENABLE_PROCESS_WAIT_RESUME_SCHEDULER | Waits resumed |
| TC-ASYNC-016 | Deferred automation | ENABLE_DEFERRED_AUTOMATION_SCHEDULER | Off-hours actions run |
| TC-ASYNC-017 | Business hours KPI | ENABLE_BUSINESS_HOURS_KPI_SCHEDULER | KPI rows written |
| TC-ASYNC-018 | Target recalc | ENABLE_TARGET_RECALC_SCHEDULER | Targets updated |
| TC-ASYNC-019 | Helpdesk SLA monitor | ENABLE_HELPDESK_SLA_SCHEDULER | SLA events once/cycle |
| TC-ASYNC-020 | Gmail inbox sync | ENABLE_GMAIL_INBOX_SYNC_SCHEDULER | New threads synced |
| TC-ASYNC-021 | Gmail watch renewal | ENABLE_GMAIL_PUSH | Watch renewed |
| TC-ASYNC-022 | Snooze wake | ENABLE_SNOOZE_WAKE_NOTIFICATION_SCHEDULER | Snooze notifications |
| TC-ASYNC-023 | Appointment reminders | ENABLE_APPOINTMENT_REMINDER_SCHEDULER | Reminders sent |
| TC-ASYNC-024 | Quote expiry | ENABLE_QUOTE_EXPIRY_SCHEDULER | Expired status set |

### 5.3 SSE Streams

| ID | Stream | Assert |
|----|--------|--------|
| TC-ASYNC-030 | `/api/notifications/stream` | Event received on trigger |
| TC-ASYNC-031 | `/api/communications/inbox/stream` | Inbox refresh event |
| TC-ASYNC-032 | `/embed/chat/sessions/:id/stream` | Chat message delivered |
| TC-ASYNC-033 | Case chat stream | Agent receives customer message |
| TC-ASYNC-034 | SSE reconnect | Client reconnects after disconnect |

### 5.4 Domain Events → Notifications

Verify each event in `server/constants/domainEvents.js` fires expected notification when rule exists:

`AUDIT_*`, `CORRECTIVE_ACTION_*`, `TASK_*`, `PEOPLE_ASSIGNED`, `DEAL_ASSIGNED`, `ORGANIZATION_ASSIGNED`, `CASE_*`, `EVIDENCE_UPLOADED`, `PORTAL_ACCOUNT_CREATED`, `USER_ADDED_TO_APP`, `SYSTEM_*`, `DIGEST_*`, `EMAIL_THREAD_SNOOZE_ENDED`

| ID | Rule |
|----|------|
| TC-ASYNC-040 | One SLA notification per threshold per cycle (no duplicates) |
| TC-ASYNC-041 | User preference opt-out suppresses channel |
| TC-ASYNC-042 | Digest batches multiple events |

---

## 6. Load & Performance Testing (ATP)

> **Do not run in PR CI** by default — set `ATP_SKIP_LOAD_TESTS=1` in CI. Use nightly `load-perf` or manual UAT.

### 6.1 Load (`TC-LOAD-*`) — 15 scenarios

Concurrent virtual users for a fixed duration. Thresholds via env (`ATP_LOAD_*`). Scenarios defined in `atp/runner/definitions/load-perf-scenarios.mjs`.

| ID | Target | Label |
|----|--------|-------|
| TC-LOAD-001 | GET `/health/ready` | Health ready |
| TC-LOAD-002 | GET `/health/live` | Health live |
| TC-LOAD-003 | GET `/health/status` | Health status |
| TC-LOAD-004 | GET `/api/people/?limit=20` | People list |
| TC-LOAD-005 | GET `/api/deals/?limit=20` | Deals list |
| TC-LOAD-006 | GET `/api/organizations/?limit=20` | Organizations list |
| TC-LOAD-007 | GET `/api/tasks/?limit=20` | Tasks list |
| TC-LOAD-008 | GET `/api/ui/registry` | UI registry |
| TC-LOAD-009 | GET `/api/ui/sidebar` | UI sidebar |
| TC-LOAD-010 | GET `/api/users/profile` | User profile |
| TC-LOAD-011 | GET `/api/search/?q=test` | Global search |
| TC-LOAD-012 | GET `/api/helpdesk/cases?limit=20` | Helpdesk cases |
| TC-LOAD-013 | GET `/api/events/?limit=20` | Events list |
| TC-LOAD-014 | GET `/api/notifications?appKey=SALES` | Notifications |
| TC-LOAD-015 | GET `/api/ui/apps` | UI apps |

Pass criteria (all): error rate ≤ `ATP_LOAD_ERROR_RATE_MAX`, p95 ≤ `ATP_LOAD_P95_MS_MAX`, RPS ≥ `ATP_LOAD_MIN_RPS`.

```bash
cd atp
npm run run:load          # load-smoke suite
npm run run:load-perf   # load + perf combined
```

| Env | Default | Purpose |
|-----|---------|---------|
| `ATP_LOAD_VUS` | 10 | Concurrent workers |
| `ATP_LOAD_DURATION_SEC` | 30 | Wall-clock duration |
| `ATP_LOAD_ERROR_RATE_MAX` | 0.05 | Max failed requests ratio |
| `ATP_LOAD_P95_MS_MAX` | 3000 | Max p95 latency (ms) |
| `ATP_LOAD_MIN_RPS` | 1 | Minimum throughput |

### 6.2 Performance (`TC-PERF-*`) — 15 scenarios

Same routes as load, but **sequential** samples (warmup + N) for single-user **p50 / p95 / p99** — not throughput.

| ID | Target | Label |
|----|--------|-------|
| TC-PERF-001 … TC-PERF-015 | *(mirrors TC-LOAD-001 … 015 paths)* | Same labels as load table |

Pass criteria (all): p95 ≤ `ATP_PERF_P95_MS_MAX`, p99 ≤ `ATP_PERF_P99_MS_MAX`, 0% errors.

```bash
npm run run:perf
```

| Env | Default | Purpose |
|-----|---------|---------|
| `ATP_PERF_SAMPLES` | 20 | Timed requests after warmup |
| `ATP_PERF_WARMUP` | 2 | Discarded warmup iterations |
| `ATP_PERF_P95_MS_MAX` | 800 | p95 cap (ms) |
| `ATP_PERF_P99_MS_MAX` | 1500 | p99 cap (ms) |

### 6.3 Heavy load (optional k6)

For stress/soak beyond ATP smoke load, add scripts under `atp/load/k6/` and run k6 separately; import results into ATP manually or extend `load-perf` executors.

---

## 7. Existing Test Coverage & Gaps

### 7.1 Automated Today

| Layer | Location | Coverage |
|-------|----------|----------|
| **ATP catalog runner** | `atp/` | **799** runnable cases with executors + dashboard documentation |
| **ATP hand suites** | `atp/runner/definitions/*.mjs` | Auth, sales, org, e2e-critical, public-smoke, security matrix |
| **ATP generated smokes** | `atp/runner/definitions/*-coverage-generated.mjs` | API/UI/E2E/public/security/async gap fill from this doc |
| Server unit | `server/utils/__tests__/` (~51 files) | Quotes, mailroom, catalog, cases, people, permissions |
| Server services | `server/services/__tests__/` | SLA, business hours, case lifecycle, email routing |
| Server integration | `server/tests/` | Communications HTTP, field governance |
| Client unit | `client/src/tests/` | Field engine, auth guards, activity adapter, i18n |
| Smoke scripts | `server/scripts/*Smoke*.js` | Helpdesk, mailroom, quotes, business-hours phase 4 |
| Manual UAT | `docs/INTERNAL_BETA_TEST_FLOWS.md` | CRM, audit, helpdesk, forms, permissions |

**ATP suites (see `atp/catalog/suites.json`):**

| Suite | Use |
|-------|-----|
| `smoke` | PR gate |
| `e2e-critical` | Boot + lead→deal |
| `security` | TC-SEC-* deep checks |
| `full` | All automated catalog cases |
| `ui-smoke` / `ui-sales` | Playwright subsets |

Regenerate after editing this file:

```bash
cd atp && npm run coverage:generate-all && npm run catalog:sync
```

### 7.2 Priority Gaps (deeper quality, not catalog presence)

Catalog IDs are **registered and smoke-automated in ATP**. Remaining work is **assertion depth** and **environment-specific** flows:

1. **Cross-tenant negatives** — TC-SEC-MT-* smokes exist; add second-org JWT fixtures for strict IDOR proofs
2. **Lead → contact → deal** — `e2e-critical` hand suite; extend TC-E2E-SLS-* beyond API-proxy smokes
3. **Audit check-in → submit → close** — TC-E2E-AUD-003–006 need full Playwright + seeded audit data
4. **Public booking + appointments** — TC-PUB-BOOK-* / TC-PUB-APT-* need valid slugs/tokens in `fixtures/public.json`
5. **CSV import + worker** — TC-E2E-IMP-001 + TC-ASYNC-004; worker must run on SUT
6. **Embed chat SSE** — TC-PUB-CHAT-* / TC-ASYNC-034; `ATP_EMBED_INSTANCE_KEY` + live SSE
7. **Quote approval → public accept** — TC-E2E-QTE-003–005 with `ATP_PUBLIC_QUOTE_TOKEN`
8. **App entitlement matrix** — TC-SEC-APP-* UI smokes; seat-specific personas per app
9. **Production rate limits** — TC-SEC-RL-* / TC-API-AUTH-003 with Redis in prod-like env
10. **UI registry depth** — TC-UI-* generated route smokes; add record-page CRUD Playwright per module

### 7.3 Recommended Tool Stack

| Layer | Tool | Notes |
|-------|------|-------|
| **Orchestration** | **ATP** (`atp/`) | Catalog sync, suites, dashboard, HTML reports, Go/No-Go |
| API | ATP + Node `--test` + supertest | Reuse `server/tests/` patterns; ATP for cross-module smokes |
| E2E API+UI | ATP + Playwright | SSE, tabs, dynamic routes; `ATP_UI_TRACE=1` on failure |
| Load | k6 | Rate limits, public quote endpoints |
| Contract | OpenAPI (future) or route snapshot tests | Detect drift vs this doc |
| CI | GitHub Actions | `atp/catalog:check` + `atp/run:smoke` + `test:*` shards |

### 7.4 Test Data Fixtures

| Fixture | Source |
|---------|--------|
| Internal beta tenant | `npm run seed:internal-beta` |
| Role matrix | Owner, rep, viewer, helpdesk agent, auditor, portal user |
| Mailroom samples | `simulateParserInboundLocal.js`, `simulateMailboxLocal.js` |
| Helpdesk SLA | `simulateHelpdeskSla.js` |
| Notifications | `simulateHelpdeskNotification.js` |

---

## 8. Implementation Checklist

When adding a new feature, extend automation in **all layers** and **ATP**:

1. **This doc:** Add table row(s) with clear **Scenario** and **Expected** (ATP derives human-readable docs from them).  
2. **API:** Section 2 — every new route + negative permission/tenancy cases.  
3. **E2E:** Cross-module flow if feature touches notifications, trash, or another app.  
4. **UI:** Section 4 — route in backticks in Scenario column (e.g. `` `/deals` ``) for UI generator.  
5. **Async:** Queue/cron row if background work.  
6. **Public:** TC-PUB-* if unauthenticated surface.  
7. **ATP executor:** Hand-written in `atp/runner/definitions/*.mjs` **or** rely on `npm run coverage:generate-all` after sync.  
8. **Sync:** `cd atp && npm run catalog:sync` — refreshes `catalog/index.json` and documentation.  
9. **Suite:** Add case ID to `atp/catalog/suites.json` if it belongs in `smoke` / `nightly` / etc.  
10. **Override (optional):** Rich doc in `atp/fixtures/case-docs-overrides.json` for onboarding-critical cases.  
11. **CI:** `npm run catalog:check` + `npm run run:smoke` (or relevant suite).  

### Case detail blocks

For complex cases, append a subsection under the domain heading:

```markdown
#### Case detail: TC-API-HEALTH-001

| Field | Value |
|-------|--------|
| **Summary** | One-line goal |
| **How to run** | Numbered steps |
| **Request** | Method, path, auth, body |
| **Expected** | Status + behavior |
| **If it fails** | Typical error, checks, remediation |
```

ATP does not parse these blocks automatically today — copy into `case-docs-overrides.json` or implement the executor in `atp/runner/definitions/`.

---

## Appendix A: Trashable Modules

`people`, `organizations`, `deals`, `quotes`, `tasks`, `events`, `items`, `cases` (+ non-submitted form responses per product rules)

Always test via `deletionService` — never assert hard delete.

## Appendix B: App Keys

`SALES` | `HELPDESK` | `PROJECTS` | `PORTAL` | `AUDIT` | `LMS` | `CONTROL_PLANE`

## Appendix C: Related Docs

| Doc | Purpose |
|-----|---------|
| `Architecture_Document.md` | Schemas, middleware, tenancy |
| `atp/README.md` | ATP install, suites, full run |
| `docs/testing/ATP_USER_GUIDE.md` | Dashboard, schedules, Go/No-Go, reports |
| `docs/testing/ARIVU_TEST_PLATFORM_ROADMAP.md` | ATP phases / roadmap |
| `docs/INTERNAL_BETA_TEST_FLOWS.md` | Manual UAT flows |
| `docs/UAT_DEV_ENVIRONMENT.md` | UAT setup |
| `docs/HELPDESK_QA_ROLLOUT_CHECKLIST.md` | Helpdesk QA |
| `docs/security/SECURITY_GUIDELINES.md` | Security test requirements |

## Appendix D: Test Case Count Summary

| Category | Catalogued in this doc | ATP automated (June 2026) |
|----------|------------------------|---------------------------|
| Platform gates (auth, RBAC, MT, security) | ~60 | Yes (smoke + `security` suite) |
| API automation (all domains) | ~432 | Yes (hand + generated API smokes) |
| E2E business flows | ~132 | Yes (hand flows + API-proxy smokes) |
| UI automation | ~134 | Yes (hand Playwright + route smokes) |
| Public/webhook | ~39 | Yes (hand + public smokes) |
| Async/background | ~28 | Yes (cron/import smokes) |
| **Total catalogued** | **805** | **799 runnable** (6 section-header rows only) |

## Appendix E: ATP documentation schema

Stored on each catalog entry as `documentation` (JSON). Shown in dashboard **Catalog** and **Run detail**.

| Field | Type | Description |
|-------|------|-------------|
| `summary` | string | Plain-language what the case verifies |
| `howToRun` | string[] | Step-by-step execution |
| `request` | object | `method`, `path`, `auth`, `body`, `headers` |
| `expected` | object | `status` (number, array, or label), `behavior` |
| `onFailure` | object | `typicalError`, `likelyCauses[]`, `remediation[]` |

**Sources (merge order):**

1. `atp/fixtures/case-docs-overrides.json` — highest priority  
2. Auto-built from this document’s table row + `atp/runner/definitions/coverage-*.json` routes  
3. Optional `documentation` on `defineHttpCase` / `defineCase` in hand-written definitions  

**API:** `GET /atp/catalog/:caseId` returns `{ entry }` including `documentation`.

---

*Update this document when adding routes, apps, public surfaces, cron jobs, or trashable modules. Then run `cd atp && npm run catalog:sync`.*
