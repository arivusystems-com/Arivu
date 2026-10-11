# Arivu Test Platform (ATP) — Product Roadmap

> **Codename:** ATP · **Goal:** In-house, best-in-class quality platform with UI dashboard, full-product coverage, and actionable reports  
> **Catalog source:** `Automation_Testing.md` (~865 TC-* cases)  
> **Status:** Roadmap v1 · June 2026

---

## 1. Vision

Build **Arivu Test Platform (ATP)** — a dedicated quality system that:

1. **Runs everything** — API, E2E business flows, UI (Playwright), public surfaces, webhooks, async/cron verification, and existing smoke scripts — mapped 1:1 to `TC-*` IDs.
2. **Feels premium** — live run theater, drill-down failure forensics, trend analytics, environment diff, flake scoring.
3. **Stays accurate** — isolated test tenants, deterministic fixtures, strict assertions (status + body + side effects), no `DISABLE_SECURITY` in default suites.
4. **Stays easy** — one-click suites (“Smoke”, “Nightly Full”, “Pre-release”), persona picker, schedule from UI, “re-run failed only”.

ATP is **not** a replacement for unit tests in `client/src/tests` and `server/utils/__tests__`. It **orchestrates and reports** product-level automation on top of them.

---

## 2. Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Catalog-driven** | Every executable test declares `id: TC-API-DEAL-004`; dashboard groups by domain/app from catalog metadata |
| **Environment-aware** | Runs tagged `local` \| `uat` \| `staging`; never hardcode URLs |
| **Tenant-safe** | Dedicated `arivu-qa-*` orgs per run; teardown or snapshot restore |
| **Parallel by default** | API tests shard across workers; Playwright projects per app |
| **Fail loud, diagnose fast** | Store request/response, HAR, screenshot, trace, console logs per failure |
| **Idempotent setup** | `beforeSuite` seeds via API; `afterSuite` optional purge |
| **CI + UI parity** | Same runner CLI (`atp run`) powers GitHub Actions and dashboard “Run” button |
| **Incremental adoption** | Ship smoke suite first; grow catalog weekly |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ATP Dashboard (Vue 3 SPA)                         │
│  Home · Runs · Catalog · Schedules · Environments · Reports · Settings   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ REST + SSE (live run progress)
┌───────────────────────────────▼─────────────────────────────────────────┐
│                     ATP Control Plane (Express 5)                          │
│  Run orchestrator · Suite scheduler · Artifact store · Webhook to Slack  │
└───────┬─────────────────┬─────────────────┬─────────────────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│ Bull queues  │  │ MongoDB      │  │ Object storage   │
│ test-runs    │  │ runs, cases, │  │ traces, videos,  │
│ api/ui/e2e   │  │ flakes, envs │  │ screenshots, PDF │
└──────┬───────┘  └──────────────┘  └──────────────────┘
       │
       ├──────────────────────────────────────────────────────────┐
       ▼                          ▼                               ▼
┌─────────────┐          ┌─────────────┐                ┌─────────────┐
│ API Executor│          │ UI Executor │                │ E2E Executor│
│ Node fetch  │          │ Playwright  │                │ Playwright  │
│ + assertions│          │ page objects│                │ + API setup │
└──────┬──────┘          └──────┬──────┘                └──────┬──────┘
       │                          │                               │
       └──────────────────────────┼───────────────────────────────┘
                                  ▼
                    ┌─────────────────────────┐
                    │   Arivu Product Under   │
                    │   Test (SUT): client +  │
                    │   server + worker + Redis│
                    └─────────────────────────┘
```

### Monorepo layout (target)

```
Arivu/
├── atp/                          # NEW — Arivu Test Platform
│   ├── control-plane/            # Express API + orchestrator
│   ├── dashboard/                # Vue 3 SPA (Vite, Tailwind 4)
│   ├── runner/                   # CLI: atp run | atp catalog | atp report
│   ├── executors/
│   │   ├── api/                  # HTTP test definitions
│   │   ├── ui/                   # Playwright specs + page objects
│   │   ├── e2e/                  # Multi-step business flows
│   │   ├── public/               # Token/HMAC webhook tests
│   │   └── async/                # Queue/cron polling helpers
│   ├── catalog/                  # Parsed Automation_Testing.md + JSON index
│   ├── fixtures/                 # Personas, seed helpers, HMAC keys
│   └── shared/                   # Types, assertion lib, env resolver
└── docs/testing/                 # This roadmap, runbooks, Automation_Testing.md (human catalog, source of truth)
```

---

## 4. Technology Choices

| Layer | Choice | Why |
|-------|--------|-----|
| Dashboard UI | Vue 3.5 + Vite 7 + Tailwind 4 + Chart.js | Matches product stack; team familiarity |
| Control plane | Express 5 + Mongoose 8 | Same as `server/`; reuse patterns |
| Job queue | Bull + Redis | Already in product; parallel run workers |
| UI/E2E runner | **Playwright** | Best Vue SPA support, trace viewer, SSE, multi-tab |
| API runner | Node native `fetch` + custom assertion DSL | Lightweight; no Jest overhead for HTTP |
| Live updates | SSE | Same pattern as notifications/inbox |
| Artifacts | Local disk (dev) / S3-compatible (UAT+) | Traces, PDF reports |
| Auth for ATP | Separate JWT + `qa_admin` role | Never mix with product auth in prod |
| Report export | HTML (interactive) + PDF (executive) | Puppeteer or `@react-pdf` server-side |

**Avoid:** Cypress (weaker trace/SSE), Postman-only (no dashboard ownership), k6-only (load ≠ functional coverage).

---

## 5. Core Data Model

### Collections (ATP MongoDB — separate DB `arivu_atp` recommended)

| Collection | Purpose |
|------------|---------|
| `test_catalog_entries` | `{ id, layer, domain, appKey, title, steps?, automated, filePath }` synced from markdown |
| `test_suites` | `{ key, name, caseIds[], tags[], estimatedMinutes }` e.g. `smoke`, `nightly`, `pre-release` |
| `environments` | `{ key, baseUrl, clientUrl, secretsRef, healthCheckUrl }` |
| `test_runs` | `{ runId, suiteKey, envKey, status, startedAt, finishedAt, triggeredBy, stats }` |
| `test_results` | `{ runId, caseId, status, durationMs, error, artifacts[] }` |
| `flake_scores` | `{ caseId, passRate30d, lastFlippedAt, quarantine }` |
| `schedules` | `{ cron, suiteKey, envKey, notifyChannels[] }` |

### Run statuses

`queued` → `running` → `passed` | `failed` | `cancelled` | `partial` (with failures)

### Result statuses

`passed` | `failed` | `skipped` | `flaky-pass` | `quarantined`

---

## 6. Dashboard — Screen Spec

### 6.1 Home (Command Center)

- **Quality score ring** — pass rate last 7 days (weighted: platform gates 2×, E2E 1.5×)
- **Last run cards** — Smoke / Nightly / Manual with duration + delta vs previous
- **Live run banner** — if active: progress bar, cases/min, ETA, cancel button
- **Failure heatmap** — grid: domain (rows) × layer API/E2E/UI (columns), color = fail count 7d
- **Flaky top 5** — cases with unstable pass rate; quarantine toggle
- **Quick actions** — Run Smoke · Run Full · Re-run last failed · Open catalog

### 6.2 Run Detail (Spectacular)

- **Timeline header** — suite, env, git SHA, trigger user, total time
- **Live tree** — expandable: Domain → Case → steps; green/red/amber in real time (SSE)
- **Split on failure** — left: step list; right: **forensics panel**
  - API: method, URL, request/response JSON diff, expected assert
  - UI: screenshot + Playwright trace link + console errors
  - E2E: step that failed + prior step artifacts
- **Compare** — overlay last passed run vs this run (response diff)
- **Actions** — Re-run this case · Copy curl · Create GitHub issue template · Mark quarantine

### 6.3 Catalog Explorer

- Browse all `TC-*` from `Automation_Testing.md`
- Filters: layer, app, domain, automated?, last result, flaky?
- Bulk: add to custom suite · mark for automation sprint
- Coverage bar: **automated / total** per domain (target 100% over roadmap)

### 6.4 Reports

- **Executive PDF** — pass rate, critical failures, trend chart, release recommendation (Go/No-Go)
- **Sprint report** — new cases automated, fixed flakes, regressions introduced
- **Environment diff** — same suite on UAT vs staging side-by-side
- **Historical trends** — 30/90 day pass rate, duration p95, failure taxonomy

### 6.5 Schedules & Environments

- CRUD environments (masked secrets)
- Cron schedules with Slack/email on failure
- Pre-run health gate: `/health/ready` must pass before suite starts

### 6.6 Settings

- Notification channels (Slack webhook, email)
- Parallelism limits (API workers, Playwright shards)
- Default persona credentials (vault refs)
- Git integration (optional): link run to commit

---

## 7. Test Definition Format (Developer UX)

### API test (YAML or TS — recommend TS for type safety)

```typescript
// atp/executors/api/deals/create.test.ts
import { defineCase } from '@atp/shared';

export default defineCase({
  id: 'TC-API-DEAL-004',
  domain: 'SALES',
  persona: 'sales_rep',
  steps: [
    { name: 'Create deal', request: { method: 'POST', path: '/api/deals', body: '{{fixtures.deal}}' },
      assert: { status: 201, body: { name: '{{fixtures.deal.name}}' } } },
    { name: 'Verify list', request: { method: 'GET', path: '/api/deals' },
      assert: { status: 200, bodyContains: { id: '{{prev.response._id}}' } } },
  ],
});
```

### UI test (Playwright)

```typescript
// atp/executors/ui/deals/kanban.spec.ts
test('TC-UI-SLS-009 kanban stage drag', async ({ page, persona }) => {
  await persona.login('sales_rep');
  await page.goto('/deals');
  await page.dragAndDrop('[data-deal-id="…"]', '[data-stage="Negotiation"]');
  await expect(page.locator('[data-deal-id="…"]')).toContainText('Negotiation');
});
```

### E2E flow (orchestrated)

```typescript
// atp/executors/e2e/sales/lead-to-deal.flow.ts
export default defineFlow({
  id: 'TC-E2E-SLS-001',
  steps: ['api.people.create', 'api.people.convert', 'api.deals.create', 'ui.deals.verifyKanban'],
});
```

**Easy to use:** Developers add one file per case; `atp catalog sync` updates dashboard index from `Automation_Testing.md` + file scan.

---

## 8. Predefined Suites (Ship Order)

| Suite key | Cases (initial) | Target duration | Gate |
|-----------|-----------------|-----------------|------|
| `smoke` | Platform gates + TC-API-AUTH-* + health + 1 case per app | < 5 min | Every PR |
| `sales-core` | People, deals, tasks API + UI list smoke | < 15 min | Nightly |
| `helpdesk-core` | Cases + mailroom smoke scripts wrapped | < 15 min | Nightly |
| `security` | TC-SEC-* MT + RBAC + app entitlements | < 20 min | Nightly |
| `public` | TC-PUB-* forms, quotes, booking, chat | < 15 min | Nightly |
| `e2e-critical` | Top 25 E2E flows (lead→deal, quote approval, audit execute, case email) | < 45 min | Pre-release |
| `full` | All automated cases | < 4 h | Weekly + manual |

---

## 9. Phased Roadmap

### Phase 0 — Foundation (Weeks 1–2)

**Goal:** Repo scaffold, catalog sync, CLI skeleton, empty dashboard shell.

| Deliverable | Details |
|-------------|---------|
| `atp/` monorepo package | workspace in root or nested; `npm run atp:dev` |
| Catalog parser | Parse `Automation_Testing.md` → `catalog/index.json` (865 entries) |
| `atp run --dry-run` | Lists cases for suite without executing |
| Control plane MVP | `POST /atp/runs`, `GET /atp/runs/:id`, Mongo models |
| Dashboard shell | Login, Home placeholder, Catalog table (read-only) |
| CI stub | GitHub Action job that runs `atp catalog sync --check` |

**Exit criteria:** Catalog visible in UI; run record persisted (manual trigger).

---

### Phase 1 — API Executor + Live Run UI (Weeks 3–6)

**Goal:** Automate platform gates + SALES API core; live dashboard during runs.

| Deliverable | Details |
|-------------|---------|
| API executor engine | Persona login, token cache, assert DSL, parallel workers |
| Fixture library | `fixtures/personas.json` + seed hook to `seed:internal-beta` |
| Implement ~80 cases | §1 Platform gates + §2.1–2.5 (auth, people, deals, tasks) |
| Bull worker | `atp-api` queue, concurrency config |
| SSE run stream | Dashboard live tree updates |
| Failure forensics v1 | Request/response JSON stored per failure |
| Suite `smoke` | Wired to PR CI |

**Exit criteria:** Smoke suite green on local + UAT; dashboard shows live progress; < 5 min smoke.

---

### Phase 2 — UI Executor (Playwright) (Weeks 7–10)

**Goal:** Browser automation with traces; UI failure screenshots in dashboard.

| Deliverable | Details |
|-------------|---------|
| Playwright project | Base URL from env; `persona.login()` helper |
| Page objects | Login, platform home, people list, deals kanban, case record |
| Implement ~40 UI cases | §4.1–4.4 priority routes |
| Artifact upload | Traces/screenshots → control plane storage |
| Forensics v2 | Embedded trace viewer link in run detail |
| Suite `sales-core` | API + UI combined nightly |

**Exit criteria:** TC-UI-AUTH-001–005 + TC-UI-SLS-009 (kanban) stable; trace accessible from UI.

---

### Phase 3 — E2E Flows + Public/Webhook (Weeks 11–14)

**Goal:** Cross-module journeys and unauthenticated surfaces.

| Deliverable | Details |
|-------------|---------|
| E2E orchestrator | Multi-step flows with shared context |
| Implement 25 critical E2E | §3.2, 3.3, 3.8, 3.10 (lead→deal, quote, case, audit) |
| Public executor | HMAC webhooks, quote tokens, form slug, booking slug |
| Wrap existing smokes | `helpdeskSmokeChecks`, `mailroomSmokeChecks`, `quotesSmokeChecks` as ATP cases |
| Suite `e2e-critical` + `public` | Pre-release gate |

**Exit criteria:** Lead→deal E2E passes; public quote accept flow passes; smoke scripts unified under ATP.

---

### Phase 4 — Async, Security, Full Catalog Push (Weeks 15–18)

**Goal:** Background verification; security matrix; coverage expansion.

| Deliverable | Details |
|-------------|---------|
| Async executor | Trigger import/email → poll job status / ImportHistory |
| Cron verification hooks | Manual trigger endpoints for SLA/digest/quote expiry in UAT |
| Security suite | All TC-SEC-* automated (~60 cases) |
| Catalog coverage | 400+ cases automated (50% of catalog) |
| Flake detection v1 | 3-run variance → flake score |
| Quarantine UI | Exclude flaky cases from gate suites optionally |

**Exit criteria:** CSV import E2E with worker; MT-001 cross-tenant negative passes; 50% catalog automated.

---

### Phase 5 — Reports, Schedules, Polish (Weeks 19–22)

**Goal:** Executive-ready reports; scheduled runs; production-grade UX.

| Deliverable | Details |
|-------------|---------|
| PDF/HTML reports | Executive + sprint templates |
| Schedule UI | Cron + Slack notify on failure |
| Environment diff view | Compare runs across envs |
| Go/No-Go widget | Rule engine: smoke 100% + e2e-critical 95% + no P0 failures |
| Full suite `full` | Nightly weekly automation |
| Documentation | `docs/testing/ATP_USER_GUIDE.md` |
| Helm/docker | `docker-compose.atp.yml` for one-command local ATP stack |

**Exit criteria:** Scheduled nightly to Slack; PDF report generated; dashboard deemed “production ready” by QA lead.

---

### Phase 6 — Excellence (Weeks 23+, continuous)

| Item | Details |
|------|---------|
| 100% catalog automation | Remaining TC-UI-* settings tabs, edge cases |
| Visual regression | Optional Percy-style screenshot diff for key pages |
| Load smoke | k6 subset for rate-limit endpoints only |
| AI-assisted failure summary | Optional: LLM summarizes failure cluster (internal only) |
| Multi-tenant parallel runs | Isolated org per shard |

---

## 10. Accuracy & Reliability Practices

| Practice | Detail |
|----------|--------|
| **No flaky waits** | Playwright `expect` auto-wait; ban fixed `sleep` except async polling |
| **Deterministic data** | UUID suffix on names; cleanup in `afterSuite` or dedicated QA org per run |
| **Assert depth** | API: status + schema keys + business invariants (e.g. `organizationId` match) |
| **Side-effect checks** | E2E: verify notification count, trash entry, or DB poll where critical |
| **Retry policy** | UI only: 1 retry on failure; mark `flaky-pass`; never retry security negatives |
| **Health gate** | Abort run if SUT `/health/ready` fails |
| **Version pin** | Store SUT git SHA on every run for bisect |
| **Quarantine** | Flaky cases excluded from PR gate until fixed |

---

## 11. CI/CD Integration

```yaml
# .github/workflows/atp-smoke.yml (Phase 1+)
- name: ATP Smoke
  run: |
    cd atp && npm run atp run -- --suite smoke --env ci
    npm run atp report -- --run-id $RUN_ID --format junit >> test-results.xml
```

| Gate | When | Suite |
|------|------|-------|
| PR | Every push | `smoke` |
| Merge to main | Nightly cron | `sales-core` + `helpdesk-core` + `security` |
| Release branch | Manual | `e2e-critical` + `public` |
| Weekly | Sunday | `full` |

---

## 12. Success Metrics (KPIs)

| Metric | Target (6 mo) |
|--------|-----------------|
| Catalog automation coverage | ≥ 80% of TC-* |
| Smoke suite duration | < 5 min |
| Smoke pass rate (UAT) | ≥ 99% |
| Mean time to diagnose failure | < 3 min (via forensics panel) |
| Flaky case rate | < 2% of suite |
| Weekly full run | Automated with report to Slack |
| Regressions caught pre-merge | ≥ 90% of API/UI breaks |

---

## 13. Team & Ownership

| Role | Responsibility |
|------|----------------|
| **QA lead** | Suite definitions, Go/No-Go rules, catalog priority |
| **Platform eng** | ATP control plane, executor engine, CI |
| **Feature teams** | Add ATP case when shipping feature (checklist in PR template) |
| **DevOps** | UAT env, secrets, S3 artifacts, Redis for ATP workers |

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Flaky UI tests | Page objects, quarantine, trace-first debug |
| Long full suite | Parallel shards, tag-based suites, nightly not PR |
| Test data pollution | Dedicated QA tenants; run-scoped UUIDs |
| ATP vs product coupling | Separate `arivu_atp` DB; SUT accessed only via public URLs |
| Maintenance burden | Catalog sync CI check; one-case-one-file convention |
| Credential leakage | Vault/env refs; never commit secrets; mask in UI |

---

## 15. Immediate Next Steps (Week 1 Checklist)

- [ ] Create `atp/` directory scaffold (control-plane, dashboard, runner, catalog)
- [ ] Implement `catalog/sync` parser from `Automation_Testing.md`
- [ ] Stand up ATP control plane on port `3099` (avoid clash with client/server)
- [ ] Dashboard: Catalog explorer + empty Home
- [ ] First executable case: `TC-API-AUTH-001` login happy path
- [ ] Document env template: `atp/.env.example` (SUT URLs, QA personas)
- [ ] Add PR template item: “ATP case added/updated for this feature?”

---

## 16. Related Documents

| Document | Path |
|----------|------|
| Test case catalog | `/docs/testing/Automation_Testing.md` |
| Architecture reference | `/docs/Architecture_Document.md` |
| Manual UAT flows | `/docs/INTERNAL_BETA_TEST_FLOWS.md` |
| UAT environment | `/docs/UAT_DEV_ENVIRONMENT.md` |
| User guide (Phase 5) | `/docs/testing/ATP_USER_GUIDE.md` *(to create)* |

---

*Follow phases sequentially. Do not start Phase 2 UI until Phase 1 API smoke is stable on UAT. Update this roadmap when scope or timelines change.*
