# Duplicate Prevention & Management

**Status:** Implemented (MVP + detect for deals/tasks/cases)  
**Area:** Core Platform → Module Configuration  
**Capability:** Duplicate Detection, Prevention & Merge

## Architecture

Instance-level **Core Duplicate Engine** + per-module **Duplicate Prevention** configuration.

```
Arivu Instance
      │
Core Duplicate Engine
      │
 ┌────┼────┬────┬────┐
People Orgs Items Deals Tasks Cases
 (module rules; merge only on master records)
```

- One engine per tenant; module rules only.
- Never evaluate records across tenants.
- Mailroom / marketing audience / payment idempotency remain separate.

## Product decisions (resolved)

| Decision | Resolution |
|----------|------------|
| People email match | Exact email → policy `attach` (default), `warn`, or `reject`. Similar → warn only. |
| Import All / create_anyway | Disabled when Duplicate Prevention is **enabled** for that module. |
| Items | Default rule = Item Code Exact. Name uniqueness goes through the engine when configured. |
| Deals / Tasks / Cases | Detect + warn/reject only. **No** Compare & Merge UI or merge API. |
| Keep Both | Not offered when rules are ON. |

## Defaults (provision)

| Module | Logic | Conditions | Ignore blank | Check inactive | Policy |
|--------|-------|------------|--------------|----------------|--------|
| people | OR | email Exact, phone Exact | ON | ON | attach |
| organizations | OR | domain Exact, taxId Exact, name Exact | ON | ON | warn |
| items | OR | item_code Exact | ON | ON | reject |
| deals | OR | name Exact | ON | ON | warn |
| tasks | OR | title Exact | ON | ON | warn |
| cases | OR | caseId Exact | ON | ON | reject |

Max **3** conditions per module.

**Mergeable modules:** `people`, `organizations`, `items` only (`MERGEABLE_MODULES`).

## Configuration

`Module → Configuration → Duplicate Prevention`  
Settings UI: `/settings?tab=core-modules&moduleKey={people\|organizations\|items\|deals\|tasks\|cases}&mode=duplicate-prevention`

Storage: `DuplicatePreventionConfig` `(organizationId, moduleKey)`.

## Engine API (internal)

`server/services/duplicates/`

- `normalize.js` — email, phone, text, domain, codes, titles
- `configService.js` — get/upsert/seed defaults
- `evaluate.js` — AND/OR Exact/Similar match within tenant
- `mergeService.js` — master select, field survivorship, participation union, reassign, archive (**mergeable modules only**)
- `events.js` — domain events

## Call sites

Create/edit hooks (people, orgs, items, deals, tasks, cases), import (`importDuplicateQuery` delegates for engine modules when enabled), webforms, Astra create issues, People `createOrAttach`, Items create.

## Permissions

| Permission | Purpose |
|------------|---------|
| `settings.edit` | Configure rules |
| `{module}.merge` | Merge master records (`people.merge`, `organizations.merge`, `items.merge`) |
| Module create/view | See duplicate warnings |

## Domain events

`record.duplicate.detected` · `record.duplicate.rejected` · `record.merge.started` · `record.merge.completed` · `record.merge.failed`

## Non-goals (MVP)

Weighted/AI matching, duplicate review queue, persistent exclusions, transactional merge (deals/invoices/cases), Mailroom message dedup, task `relatedTo` composite matching.
