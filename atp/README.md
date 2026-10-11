# Arivu Test Platform (ATP)

In-house QA orchestration for the Arivu product. Phase 0 scaffold.

## Quick start

```bash
cd atp
cp .env.example .env
# Edit .env — set ATP_PERSONA_OWNER_EMAIL/PASSWORD for TC-API-AUTH-001

npm install
npm run catalog:sync

# Terminal 1 — control plane (needs MongoDB on 27017)
npm run control-plane

# Terminal 2 — dashboard
cp dashboard/.env.example dashboard/.env
npm run dashboard:dev

# Terminal 3 — run smoke (Arivu server on :3000)
npm run run:smoke:dry    # list cases only
npm run run:smoke        # execute automated cases
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3100 |
| Control plane | http://localhost:3099/atp/health |
| Product SUT | http://localhost:3000 |

## Coverage (catalog)

| Metric | Value |
|--------|-------|
| Catalog cases | 805 |
| **Automated** | **799 / 799 runnable (100%)** |
| API layer | 432 automated |
| UI / E2E / public / security / async | generated smoke + hand-written suites |

Six catalog rows are **section headers** (e.g. `TC-PUB-APT`, `TC-SEC-MT`), not runnable IDs.

Regenerate coverage after catalog changes:

Each catalog case includes **human-readable documentation** (summary, steps, request, expected behavior, failure remediation). Regenerated on `catalog:sync`; override hand-tuned cases via `fixtures/case-docs-overrides.json`.

```bash
npm run coverage:generate-all   # API + UI/E2E/public/security/async JSON
npm run catalog:sync            # also writes catalog/case-docs.json
npm run run:full            # functional only (excludes load/perf)
npm run run:full-all        # everything including load/perf mirrors

Each case records an **execution trace** (ordered steps with path and ms). Expand a case on Run detail to see the waterfall; set `ATP_UI_TRACE=1` for Playwright `.zip` artifacts.
npm run run:load            # 15 core load scenarios
npm run run:load:full       # all GET routes from API catalog (~250+)
npm run run:perf            # 15 core perf scenarios
npm run run:perf:full       # perf mirror of all load routes
npm run run:load-perf       # full load + perf (nightly only)
npm run perf:scenarios      # regenerate from coverage-routes.json
```

**API timing:** every HTTP case records `latencyMs` per request (dashboard + run results). **Load/perf** show RPS, p95, p99, wall time.
npm run run -- --suite coverage-api   # settings/targets/config sample
```

## Phase 5

- **HTML reports** — executive + sprint (`/atp/runs/:id/report`)
- **Schedules** — cron + Slack on failure (dashboard **Schedules**)
- **Go/No-Go** — smoke 100% + e2e-critical ≥95% (home widget)
- **Compare runs** — env diff (`/compare` or `/atp/runs/compare`)
- **Docker stack** — `npm run stack:up` (`docker-compose.atp.yml`)
- **User guide** — [docs/testing/ATP_USER_GUIDE.md](../docs/testing/ATP_USER_GUIDE.md)

```bash
npm run stack:up
npm run run:full
```

## Phase 4

- **Async import** — `TC-ASYNC-004` queues CSV import, polls until `completed`/`failed`
- **Security suite** — RBAC, multi-tenant negatives, CSRF, app entitlements (`run:security`)
- **API breadth** — parallel module GET smokes (`run:api-breadth`)
- **SUT health gate** — aborts run if `/health/ready` fails (`ATP_SKIP_HEALTH_GATE=1` to bypass)
- **Quarantine** — `fixtures/quarantine.json` excludes flaky cases from suites
- **Retry** — `ATP_RETRY_ON_FAIL=1` retries non-security cases once

| Suite | Focus |
|-------|--------|
| `security` | TC-SEC-* matrix |
| `async-import` | Import job + poll (sequential) |
| `async-cron` | Digest manual triggers |
| `api-breadth` | Cross-module GET coverage |
| `nightly` | Combined gate |

```bash
npm run run:security
npm run run:async-import
npm run run:api-breadth
npm run run:nightly
```

## Phase 3

- **E2E orchestrator** — `e2eFlow.mjs`, `e2e-critical` suite (lead→deal)
- **Public executor** — webhooks, quotes, embed chat (`run:public`)
- **Wrapped smokes** — helpdesk, quotes, mailroom evaluate

## Phase 2

- **Playwright UI executor** — `runner/lib/uiSession.mjs`, `uiRunner.mjs`, page objects
- **Navigation** — sidebar link clicks (cold `page.goto(/people)` redirects to platform home in SPA)
- **Failure artifacts** — screenshots in `atp/artifacts/{caseId}/`; set `ATP_UI_TRACE=1` for traces
- **110 automated cases** in catalog

### UI suites

| Suite | Cases | Focus |
|-------|-------|-------|
| `ui-smoke` | 5 | Auth session (TC-UI-AUTH-001–005) |
| `ui-platform` | 8 | Platform home, trash, sidebar, tabs, theme, inbox, approvals |
| `ui-sales` | 13 | Dashboard, people, orgs, deals kanban, tasks, groups |
| `sales-core` | 10 | API + UI nightly gate |

```bash
npm run run:ui
npm run run:ui-platform
npm run run:ui-sales
npm run run:sales-core
ATP_UI_HEADLESS=0 npm run run:ui-sales   # watch browser
ATP_UI_TRACE=1 npm run run:ui-smoke      # save Playwright traces
```

## Phase 1

- **Definition-based API tests** in `runner/definitions/` (~80 cases)
- **Response helpers** — `runner/lib/responseHelpers.mjs` normalizes `{ success, data }` shapes
- **Personas** via `fixtures/personas.json` or `ATP_PERSONA_*` env
- **Parallel execution** — `ATP_API_CONCURRENCY=4` (sales/org suites run sequential)
- **Live run updates** — SSE + polling on run detail page
- **Dashboard execute** — Home triggers smoke, platform, sales, org suites

### Suites

| Key | Cases | Use |
|-----|-------|-----|
| `smoke` | 8 | PR gate |
| `platform-gates` | 18 | Auth + security API |
| `sales-api-core` | 33 | Users, people, deals, tasks (sequential) |
| `org-api-core` | 20 | Org, config, trash, search (sequential) |
| `e2e-critical` | 8 | Boot + lead→deal (sequential) |
| `public-smoke` | 9 | Public forms, webhooks, quotes, chat |
| `helpdesk-core` | 2 | Helpdesk analytics + mailroom evaluate |
| `quotes-core` | 2 | Quotes API + public share token |

```bash
npm run run:smoke
npm run run:platform
npm run run:sales
npm run run:org
npm run run:e2e
npm run run:public
npm run run:helpdesk
node runner/cli.mjs suites
```

**Phase 3 fixtures:** copy `fixtures/public.example.json` → `fixtures/public.json` or set `ATP_PUBLIC_QUOTE_TOKEN`, `ATP_EMBED_INSTANCE_KEY` in `.env`.

```bash
npm run catalog:sync          # Parse docs/testing/Automation_Testing.md → catalog/index.json
npm run catalog:check         # CI: fail if catalog stale
npm run run -- --suite smoke --dry-run
npm run run -- --suite smoke --env local
node runner/cli.mjs suites
```

## Case documentation

| Field | Meaning |
|-------|---------|
| `summary` | Plain-language what is being verified |
| `howToRun` | Step-by-step execution |
| `request` | Method, path, auth, body, headers |
| `expected` | Status band + behavior |
| `onFailure` | Typical error, causes, what to do |

Dashboard **Catalog** — expand any row. **Run detail** — expand a result (especially failures).

Optional overrides: `cp fixtures/case-docs-overrides.example.json fixtures/case-docs-overrides.json`

## Adding a test case

1. Add to `runner/definitions/*.mjs` using `defineHttpCase` or `defineCase` (optional `documentation` on spec)
2. Register in `runner/definitions/index.mjs` if new file
3. Add case ID to `catalog/suites.json` if needed
4. Run `npm run catalog:sync`

## Roadmap

See [docs/testing/ARIVU_TEST_PLATFORM_ROADMAP.md](../docs/testing/ARIVU_TEST_PLATFORM_ROADMAP.md)
