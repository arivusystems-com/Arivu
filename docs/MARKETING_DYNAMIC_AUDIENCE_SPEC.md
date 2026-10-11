# Marketing — Dynamic Audience & Multi-Level Relationship Engine

**Module:** Marketing  
**Version:** 1.1  
**Status:** ✅ Implemented (v1) — Phases A–C shipped 2026-07-01  
**Supersedes:** M3 baseline segmentation (People-only flat filters)  
**Related docs:** [MARKETING_APPLICATION_ROADMAP.md](./MARKETING_APPLICATION_ROADMAP.md) · [Architecture_Document.md](./Architecture_Document.md) · Dynamic Audience Builder PRD (PDF)

**Last updated:** 2026-07-01

---

## 1. Executive summary

Arivu Marketing provides a **relationship-aware, metadata-driven audience engine** that lets marketers build precise, reusable dynamic audiences without SQL, Mongo queries, or developer involvement.

The engine:

- Stores **definitions** (rules), not recipient snapshots, for dynamic audiences
- Resolves recipients from **live CRM data** at preview and campaign-send time
- Traverses **multi-level relationships** across enabled platform modules (Contact → Organization → Deal → Case, etc.)
- Reads fields, operators, and traversable paths from **platform metadata** — nothing hardcoded per module
- Always resolves campaign send targets to **People with valid email addresses**
- Delegates delivery to **AMDS** (final recipient list only; AMDS never evaluates rules)

This document is the **implementation source of truth** for dynamic segments and dynamic audiences. Static audience import/export, templates, and campaign builder are out of scope here except where they consume segment output.

---

## 2. Vision & objectives

### Vision

> Build an enterprise-grade audience engine that allows marketers to create precise, reusable, and relationship-aware audiences without writing queries or requiring technical knowledge.

The engine becomes the foundation for marketing campaigns, future automation, reports, and AI-assisted audience suggestions.

### Objectives

| Objective | Description |
|-----------|-------------|
| Visual rule builder | No-code AND/OR groups with nested conditions |
| Cross-module queries | Filter using related records, not just primary entity fields |
| Multi-level relationships | Traverse 1–N hops via platform relationship graph |
| Reusable definitions | Save segments; attach to dynamic audiences and campaigns |
| Live data | Recipients reflect CRM state at execution time |
| Preview & insights | Count, sample, quality signals before send |
| Metadata-driven | Fields/operators/paths from registry — tenant-aware |
| Performant & explainable | Bounded depth, indexed lookups, human-readable rule summary |
| Tenant-safe | Organization isolation, permissions, audit on definition changes |

### Design principles

| Principle | Rule |
|-----------|------|
| **Relationship-aware** | Rules reference `RelationshipDefinition` keys, not ad-hoc joins |
| **Dynamic by default** | Dynamic audiences store definitions; static audiences store snapshots |
| **No-code** | Marketers never see query language |
| **Reusable** | One segment → many dynamic audiences / campaigns |
| **Performant** | Cap traversal depth; index-backed resolution |
| **Explainable** | Every saved definition has a plain-language summary |
| **Scalable** | Compiler produces efficient pipelines; preview may use sampling at scale |
| **No hardcoding** | Module lists, fields, relationships come from platform metadata |

---

## 3. Terminology

| Term | Model / route | Role |
|------|---------------|------|
| **Segment** | `MarketingSegment` · `/api/marketing/segments` | Reusable **definition** — primary entity, rule AST, member count |
| **Dynamic audience** | `MarketingAudience` (`type: dynamic`) · `/api/marketing/audiences` | Named **wrapper** pointing at a segment (`segmentId`) for campaigns |
| **Static audience** | `MarketingAudience` (`type: static`) | Snapshot list (`members[]`) — unchanged by this spec |
| **Primary entity** | Stored on segment | Module whose records are the logical selection root (default: `people`) |
| **Send target** | Runtime resolution | Always **People with email** for campaign delivery |
| **Relationship path** | Ordered `relationshipKey[]` | Hops from primary entity through the CRM graph |
| **Rule AST** | `filterQuery` (extended schema) | Serialized audience definition |

**Do not merge Segment and Audience.** Segments own the builder and query engine. Dynamic audiences remain thin named references.

---

## 4. Dynamic vs static

| | Dynamic | Static |
|---|---------|--------|
| **Stores** | Rule definition (`filterQuery` on segment) | Recipient rows (`members[]`) |
| **Updates** | Automatically on preview / refresh job / send | Manual import, add, remove |
| **Use case** | Live CRM targeting | Snapshots, events, compliance |
| **Campaign send** | Execute rules → validate → send list to AMDS | Use stored members directly |

**Example dynamic definition:**

> Contacts linked to Healthcare organizations with at least one Closed Won deal in the last six months and no open cases.

If CRM data changes tomorrow, the next preview or send reflects the change.

---

## 5. Current state (shipped M3.5)

Shipped 2026-07-01. Replaces the M3 People-only query path. Legacy v1 segments (flat `fieldKey` AST without `version: 2`) continue to work via compiler fallback.

| Area | Implementation | Notes |
|------|----------------|-------|
| Segment CRUD | `marketingSegmentController.js` | v2 AST validation on create/update |
| Metadata API | `GET /api/marketing/segments/metadata` | Fields, relationships, graph — no hardcoded module lists in client |
| Query compiler | `marketingAudienceQueryCompiler.js` | Multi-hop FK + `RelationshipInstance`; legacy v1 fallback |
| Link resolver | `marketingAudienceLinkResolver.js` | Forward/backward hops; `expandPrimaryToTargetIds` |
| Aggregate evaluator | `marketingAudienceAggregateEvaluator.js` | exists, not_exists, count, sum, avg, min, max |
| Query service | `marketingSegmentQueryService.js` | Delegates preview, count, send resolution to compiler |
| AST validation | `marketingAudienceAstValidator.js` | Metadata-driven field/operator/path checks |
| Preview insights | `marketingAudiencePreviewService.js` | total, reachable, missing email, suppressed, duplicates, org/industry breakdown |
| Explain | `POST /api/marketing/segments/explain` | Plain-language rule summary |
| Client fields | `marketingAudienceFilterConfig.js` + `useMarketingAudienceMetadata` | Metadata-driven; hardcoded list removed |
| UI | `SegmentBuilder.vue`, `AudienceRelationshipRulesPanel.vue` | Primary entity, multi-hop paths, aggregate rules |
| Nested AND/OR | Filter AST v2 | Primary field rules + relationship/aggregate blocks |
| Refresh job | `marketingSegmentRefreshScheduler` | Count via new compiler |
| Dynamic audience | `segmentId` FK | Resolves through v2 compiler at preview/send |
| Tests | `npm run test:marketing-audiences` | 26 unit tests |

**Deferred to Phase D:** engagement rules via `Communication`, Redis query-plan cache, audience versioning, static freeze from dynamic definition, formal load-test benchmark (10k people / 2-hop / 3s).

---

## 6. Architecture

```
Marketer
   │
   ▼
SegmentBuilder.vue  ──GET metadata──►  /api/marketing/segments/metadata
   │                                         │
   │  save filterQuery                       ├── ModuleDefinition (filterable fields)
   ▼                                         ├── RelationshipDefinition (graph)
MarketingSegment.filterQuery                 └── TenantRelationshipConfiguration
   │
   ▼
marketingSegmentQueryService
   ├── marketingAudienceQueryCompiler (multi-hop + aggregates)
   ├── resolvePeopleWithEmail()          ← send target normalization
   └── preview / count / recipients
   │
   ├── People, Organizations, Deals, Cases, … (module collections)
   └── RelationshipInstance (graph links)
   │
   ▼
Dynamic MarketingAudience (segmentId)
   │
   ▼
Campaign send → validated recipient[] → AMDS (no rule evaluation)
```

### Middleware stack (unchanged)

`protect` → `resolveAppContext` → `requireAppEntitlement` → `requireMarketingApp` → `organizationIsolation` → `checkPermission`

### Platform reuse (required)

| Platform capability | Usage |
|--------------------|--------|
| `RelationshipDefinition` | Traversable edges; `localField` / `foreignField`; `constraints.maxDepth` |
| `RelationshipInstance` | Graph-based links between records |
| `ModuleDefinition.fields` | Filterable field catalog (`filterable`, `filterType`, `filterPriority`) |
| `getEffectiveRelationships()` | Tenant-enabled relationship set |
| `filterQueryCompiler` | **Leaf rule compilation only** (field + operator → Mongo clause) |
| `FilterBuilderPanel` / filter AST | UI shell; extended for relationship rules |
| `runWithOrganizationTenantContext` | All queries tenant-scoped |

### Implemented components

| Component | Path |
|-----------|------|
| Audience metadata service | `server/services/marketing/marketingAudienceMetadataService.js` |
| Multi-hop query compiler | `server/services/marketing/marketingAudienceQueryCompiler.js` |
| Link resolver | `server/services/marketing/marketingAudienceLinkResolver.js` |
| Aggregate evaluator | `server/services/marketing/marketingAudienceAggregateEvaluator.js` |
| Field compiler (leaf rules) | `server/services/marketing/marketingAudienceFieldCompiler.js` |
| AST validator | `server/services/marketing/marketingAudienceAstValidator.js` |
| Preview insights | `server/services/marketing/marketingAudiencePreviewService.js` |
| Explain service | `server/services/marketing/marketingAudienceExplainService.js` |
| Query service (facade) | `server/services/marketing/marketingSegmentQueryService.js` |
| Metadata endpoint | `GET /api/marketing/segments/metadata` |
| Explain endpoint | `POST /api/marketing/segments/explain` |
| Client metadata composable | `client/src/composables/useMarketingAudienceMetadata.js` |
| Relationship rule UI | `client/src/components/marketing/AudienceRelationshipRulesPanel.vue` |
| Filter config (v2 AST) | `client/src/utils/marketingAudienceFilterConfig.js` |

---

## 7. Primary entity & send target

### Primary entity

Every segment declares a **primary entity** — the module at the root of the rule tree.

```javascript
primaryEntity: {
  appKey: 'sales',      // from module / app registry
  moduleKey: 'people'   // default for marketing email
}
```

Supported primary entities (enabled per tenant via app entitlements):

| Module key | Marketing label | Notes |
|------------|-----------------|-------|
| `people` | Contacts | **Default**; direct send target |
| `organizations` | Organizations | Must resolve to contact emails via org relationships |
| `deals` | Deals | Resolve via `contactId` / relationships |
| `cases` | Cases | Resolve via requester / contact relationships |
| `quotes`, `invoices`, `sales_orders`, `items` | Per module label | Resolve to contacts when used as primary |
| Custom modules | From `ModuleDefinition` | When entitled and relationships exist |

Primary entity options are **not hardcoded** — returned by metadata API from tenant-enabled modules marked audience-eligible in platform seed.

### Send target (locked)

**All campaign sends resolve to People with a non-empty, normalized email.**

When primary entity is not `people`, the compiler runs an additional **contact resolution** step using metadata-defined “contact resolution paths” (e.g. Organization → primary contact, Deal → `contactId`).

Recipients missing email are excluded from send but reported in preview insights.

---

## 8. Multi-level relationship model

### Relationship graph (conceptual)

```
Contact (people)          ← default primary entity / send target
│
├── Organization          ← FK: people.organization + RelationshipInstance
│   ├── Deals
│   ├── Cases
│   ├── Invoices
│   ├── Quotes
│   └── Sales Orders
│
├── Deals                 ← FK: deals.contactId + RelationshipInstance
├── Cases
├── Tasks
├── Events
└── Communications        ← future: engagement rules (Phase D)
```

### Traversal rules

| Rule | Value |
|------|-------|
| Max hops (v1) | **3** (configurable via `MARKETING_AUDIENCE_MAX_RELATIONSHIP_DEPTH`, default 3) |
| Cycle prevention | Honor `RelationshipDefinition.constraints.preventCircular`; reject invalid paths at save |
| Disabled relationships | Exclude per `TenantRelationshipConfiguration.enabled === false` |
| Direction | Each hop stores `relationshipKey` + resolved **target module** from definition |
| Link resolution order | 1) FK (`localField` / `foreignField`) if present · 2) `RelationshipInstance` |

### Path representation

A **relationship path** is an ordered array of relationship keys from primary entity to the module where field conditions apply:

```json
{
  "relationshipPath": ["people_organization", "organization_deals"],
  "targetModuleKey": "deals"
}
```

Conditions in that rule block apply to **`deals`** fields after traversing Contact → Organization → Deal.

---

## 9. Rule AST schema

Stored on `MarketingSegment.filterQuery`. Backward-compatible: legacy AST without `version` uses People-only compiler.

### Root document

```typescript
interface AudienceFilterQuery {
  version: 2;                          // 1 = legacy people-only (implicit if absent)
  primaryEntity: {
    appKey: string;
    moduleKey: string;
  };
  logic: 'AND' | 'OR';
  children: AudienceFilterNode[];
}
```

### Node types

```typescript
type AudienceFilterNode =
  | AudienceFieldRule
  | AudienceRelationshipRule
  | AudienceAggregateRule
  | AudienceGroupNode;

/** Rule on the primary entity (no relationship hop) */
interface AudienceFieldRule {
  type: 'field';
  moduleKey: string;                   // must match primaryEntity.moduleKey
  fieldKey: string;
  operator: FilterOperatorId;
  value: unknown;
}

/** Rule after traversing one or more relationships */
interface AudienceRelationshipRule {
  type: 'relationship';
  relationshipPath: string[];          // relationshipKey per hop, min length 1
  targetModuleKey: string;
  logic: 'AND' | 'OR';
  children: (AudienceFieldRule | AudienceAggregateRule | AudienceGroupNode)[];
}

/** EXISTS / COUNT / SUM / etc. on related collection */
interface AudienceAggregateRule {
  type: 'aggregate';
  relationshipPath: string[];
  targetModuleKey: string;
  function: 'exists' | 'not_exists' | 'count' | 'sum' | 'avg' | 'min' | 'max';
  fieldKey?: string;                   // required for sum/avg/min/max
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  value: number | [number, number];
  filter?: AudienceGroupNode;          // optional nested conditions on related records
}

interface AudienceGroupNode {
  type: 'group';
  logic: 'AND' | 'OR';
  children: AudienceFilterNode[];
}
```

### Example (PDF §8)

> Healthcare Organizations **AND** Closed Won Deals **AND** No Open Cases

```json
{
  "version": 2,
  "primaryEntity": { "appKey": "sales", "moduleKey": "people" },
  "logic": "AND",
  "children": [
    {
      "type": "relationship",
      "relationshipPath": ["people_organization"],
      "targetModuleKey": "organizations",
      "logic": "AND",
      "children": [
        { "type": "field", "moduleKey": "organizations", "fieldKey": "industry", "operator": "is", "value": "Healthcare" }
      ]
    },
    {
      "type": "relationship",
      "relationshipPath": ["people_organization", "organization_deals"],
      "targetModuleKey": "deals",
      "logic": "AND",
      "children": [
        { "type": "field", "moduleKey": "deals", "fieldKey": "stage", "operator": "is", "value": "Closed Won" },
        { "type": "field", "moduleKey": "deals", "fieldKey": "closedDate", "operator": "last_n_days", "value": 180 }
      ]
    },
    {
      "type": "aggregate",
      "relationshipPath": ["people_organization", "organization_cases"],
      "targetModuleKey": "cases",
      "function": "not_exists",
      "filter": {
        "type": "group",
        "logic": "AND",
        "children": [
          { "type": "field", "moduleKey": "cases", "fieldKey": "status", "operator": "is_not", "value": "Closed" }
        ]
      }
    }
  ]
}
```

### Validation (on create/update)

- `version === 2` requires `primaryEntity`
- Every `relationshipPath` step must exist in metadata for the tenant
- Path depth ≤ `MARKETING_AUDIENCE_MAX_RELATIONSHIP_DEPTH`
- Every `fieldKey` must be filterable on its module per `ModuleDefinition`
- Every `operator` must be valid for field `filterType`
- Aggregate rules require `fieldKey` when function is sum/avg/min/max
- Reject circular paths at validation time

---

## 10. Operators

Extend platform filter operators. Leaf compilation delegates to `filterQueryCompiler.compileRuleToMongo` per module.

### Comparison

| Operator | ID | Filter types |
|----------|-----|--------------|
| Equals | `is` | all |
| Not equals | `is_not` | all |
| Contains | `contains` | text |
| Does not contain | `not_contains` | text |
| Starts with | `starts_with` | text |
| Ends with | `ends_with` | text |
| Is empty | `is_empty` | all |
| Is not empty | `is_not_empty` | all |
| Is any of | `is_any_of` | select, multi-select |

### Numeric

| Operator | ID |
|----------|-----|
| Greater than | `gt` |
| Less than | `lt` |
| Between | `between` |

### Date (relative — no hardcoded dates in saved rules)

| Operator | ID | Value |
|----------|-----|-------|
| Today | `today` | — |
| Yesterday | `yesterday` | — |
| Last N days | `last_n_days` | number |
| Last 7 days | `last_7_days` | — |
| Last 30 days | `last_30_days` | — |
| This month | `this_month` | — |
| Previous month | `previous_month` | — |
| Between dates | `between_dates` | `[iso, iso]` |

Relative operators resolve at **query execution time**, not at save time.

### Collection / aggregate

| Function | ID | Phase | Status |
|----------|-----|-------|--------|
| Exists | `exists` | B | ✅ |
| Does not exist | `not_exists` | B | ✅ |
| Count | `count` | C | ✅ |
| Sum | `sum` | C | ✅ |
| Average | `avg` | C | ✅ |
| Minimum | `min` | C | ✅ (server only) |
| Maximum | `max` | C | ✅ (server only) |

Operator metadata is returned by the metadata API per field type — not duplicated in client code.

---

## 11. Metadata API

### `GET /api/marketing/segments/metadata`

Returns everything the builder needs. **No hardcoded module or field lists in the client.**

**Query params:** `primaryModuleKey` (optional — defaults to `people`)

**Response:**

```json
{
  "success": true,
  "data": {
    "primaryEntities": [
      { "appKey": "sales", "moduleKey": "people", "labelKey": "modules.people", "default": true }
    ],
    "relationships": [
      {
        "relationshipKey": "people_organization",
        "label": "Organization",
        "sourceModuleKey": "people",
        "targetModuleKey": "organizations",
        "cardinality": "MANY_TO_ONE",
        "linkKind": "foreign_key",
        "localField": "organization",
        "maxDepthFromPrimary": 1
      }
    ],
    "relationshipGraph": {
      "people": ["people_organization", "people_deals", "people_cases"]
    },
    "modules": {
      "people": {
        "fields": [
          { "key": "email", "label": "Email", "filterType": "text", "operators": ["contains", "is", "is_empty"] }
        ]
      },
      "organizations": { "fields": [] },
      "deals": { "fields": [] }
    },
    "operators": {},
    "limits": {
      "maxRelationshipDepth": 3,
      "previewSampleMax": 50,
      "recipientResolveMax": 5000
    },
    "contactResolution": {
      "organizations": { "path": ["organization_primary_contact"], "targetModuleKey": "people" },
      "deals": { "field": "contactId", "targetModuleKey": "people" }
    }
  }
}
```

**Implementation notes:**

- Fields: from `ModuleDefinition` where `filterable === true`, merged with tenant overrides
- Relationships: from `RelationshipDefinition` filtered by `getEffectiveRelationships()` and marketing-eligible modules
- `relationshipGraph`: adjacency list for UI path picker (BFS up to max depth)
- Cache per org + app context; invalidate on module/relationship config change

### `POST /api/marketing/segments/explain`

Accepts draft or saved `filterQuery`; returns plain-language summary for marketer review.

```json
{
  "success": true,
  "data": {
    "summary": "Contacts whose Organization industry is Healthcare, with a Closed Won Deal in the last 180 days, and no open Cases.",
    "primaryEntity": "Contacts",
    "estimatedComplexity": "medium",
    "relationshipHops": 2
  }
}
```

---

## 12. Query compiler

**New service:** `marketingAudienceQueryCompiler.js`

Does **not** replace `filterQueryCompiler.js` globally. Uses it for leaf rules only.

### Compilation pipeline

```
1. Validate AST (schema + metadata)
2. If version missing → legacy People-only path (existing M3 behavior)
3. Resolve primary entity base query (tenant + soft-delete + module-specific base)
4. For each top-level child:
   a. field rule      → merge leaf clause on primary collection
   b. relationship    → traverse path → subquery on target module → return matching primary IDs
   c. aggregate       → traversal + aggregation pipeline → return matching primary IDs
   d. group           → recursive compile + AND/OR
5. Intersect / union primary IDs per root logic
6. resolveToPeopleWithEmail(primaryIds | primaryEntity)
7. Return { peopleQuery } or { peopleIds } for count/find
```

### Traversal algorithm (per hop)

For hop `relationshipKey` from `sourceModule` / `sourceIds`:

1. Load `RelationshipDefinition`
2. If `localField` / `foreignField` defined → direct FK query on target collection
3. Else query `RelationshipInstance`:
   ```javascript
   { organizationId, relationshipKey,
     'source.moduleKey': sourceModule, 'source.recordId': { $in: sourceIds } }
   ```
4. Collect `target.recordId` set → next hop input
5. Apply leaf/aggregate conditions on target module scoped to those IDs

### Performance

| Technique | Application |
|-----------|-------------|
| Index use | `RelationshipInstance`: `{ organizationId, relationshipKey, 'source.recordId' }` |
| Depth cap | Reject > 3 hops at validation |
| ID set batching | Chunk `$in` arrays > 1000 IDs |
| Preview sampling | Count always exact up to 100k; sample list paginated |
| Plan cache (Phase D) | Redis cache keyed by `hash(orgId + filterQuery)` TTL 5m for counts |
| Explain-only dry run | `explain()` on aggregation for slow query logging |

### Legacy fallback

Segments saved before v2 AST (no `version`, flat `fieldKey` children) continue using `marketingSegmentQueryService.buildSegmentPeopleQuery` unchanged.

---

## 13. API changes

### Model: `MarketingSegment`

Add fields:

```javascript
primaryEntity: {
  appKey: { type: String, default: 'sales' },
  moduleKey: { type: String, default: 'people' }
},
filterQueryVersion: { type: Number, default: 1 },  // denormalized from filterQuery.version
explainSummary: { type: String, default: '' }       // cached plain-language summary
```

### Endpoints (existing — behavior change)

| Method | Route | Change |
|--------|-------|--------|
| POST | `/api/marketing/segments` | Accept v2 AST; validate via metadata |
| PUT | `/api/marketing/segments/:id` | Same |
| POST | `/api/marketing/segments/preview` | Return insights (§14) |
| POST | `/api/marketing/segments/:id/preview` | Same |
| GET | `/api/marketing/segments/:id/members` | Resolve via new compiler |
| POST | `/api/marketing/segments/:id/refresh` | Same |

### Endpoints (new)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/marketing/segments/metadata` | Builder catalog |
| POST | `/api/marketing/segments/explain` | Plain-language summary |

### Dynamic audience endpoints

No schema change. `preview`, `members`, and campaign send call updated `resolveSegmentRecipients` internally.

---

## 14. Preview & audience insights

### Preview response (`POST …/preview`)

```json
{
  "success": true,
  "data": {
    "totalMatches": 1240,
    "reachableRecipients": 1180,
    "missingEmail": 42,
    "suppressed": 12,
    "duplicateEmails": 6,
    "sample": [{ "_id": "…", "email": "…", "name": "…" }],
    "breakdown": {
      "organizations": 890,
      "industries": [{ "value": "Healthcare", "count": 320 }]
    },
    "segmentId": null,
    "refreshedAt": "2026-06-30T12:00:00.000Z"
  }
}
```

| Insight | Source | Phase | Status |
|---------|--------|-------|--------|
| Total matches | Primary resolution count | A | ✅ |
| Reachable recipients | Has email ∧ not suppressed | A | ✅ |
| Missing email | People match but empty email | A | ✅ |
| Suppressed | Email suppression cross-check | A | ✅ |
| Duplicate emails | Dedupe by normalized email | A | ✅ |
| Organizations represented | Distinct org count on matched people | B | ✅ |
| Industries | Org `industry` field on resolved set | B | ✅ |
| Avg deal value / revenue | Aggregate on related deals | C | ✅ (via aggregate rules at send) |

Preview is **non-destructive** and safe to call while editing unsaved rules (pass `filterQuery` in body).

---

## 15. UI specification

### SegmentBuilder

| UI element | Behavior | Status |
|------------|----------|--------|
| Primary entity selector | Dropdown from metadata; default Contacts | ✅ |
| Rule row | Module context label + relationship breadcrumb + field + operator + value | ✅ |
| Add rule | Primary field rules + relationship rules panel | ✅ |
| Relationship path picker | Graph from `relationshipGraph`; max depth enforced; multi-hop via “Add hop” | ✅ |
| Nested groups | AND/OR groups (`FilterBuilderPanel` pattern) | ✅ |
| Aggregate rule | Has / Does not have / Count / Sum / Avg of related records with threshold | ✅ |
| Live preview panel | Count, reachable, missing email, suppressed, sample; debounced 500ms | ✅ |
| Explain panel | Call `/explain`; show summary string | ✅ |
| Save | Server-side validation; stores v2 AST | ✅ |

Hardcoded field list removed — builder uses `useMarketingAudienceMetadata` + `marketingAudienceFilterConfig.js`.

### Dynamic audience (`AudienceDetail.vue`)

Unchanged UX: pick saved segment from dropdown. Optional: show segment explain summary read-only.

### i18n

All new strings under `marketing.*` namespace. Module/field labels reuse `modules.*` and `resolveFieldLabel()`.

---

## 16. Campaign integration

Flow at send (unchanged contract, new resolver):

```
Campaign.audienceId
  → MarketingAudience (dynamic)
  → MarketingSegment.filterQuery
  → marketingSegmentQueryService.resolveSegmentRecipients()
  → validate (email, suppression, dedupe)
  → AmdsClient.sendCampaignBatch({ recipients })
```

**AMDS never receives or evaluates `filterQuery`.** Arivu sends the final recipient array only.

---

## 17. Permissions & tenancy

| Permission | Module | Actions |
|------------|--------|---------|
| `segments.view` | segments | list, preview, metadata, explain |
| `segments.create` | segments | create |
| `segments.edit` | segments | update, refresh |
| `segments.delete` | segments | delete |
| `audiences.view` | audiences | preview dynamic members |

All queries run inside `runWithOrganizationTenantContext(organizationId, …)`.

Audit: log segment create/update/delete with `filterQuery` diff hash (not full PII).

---

## 18. Out of scope (this spec)

| Item | Target |
|------|--------|
| Audience versioning (view history, restore, compare) | Future M3.5+ |
| Static snapshot from dynamic (“freeze audience”) | Audience feature |
| Campaign engagement rules (opened / clicked last campaign) | Phase D — requires Communication analytics |
| AI / natural language audiences | Future |
| Subscription preference center | M7 |
| Behavioral / predictive segments | Future |
| Query plan Redis cache | Phase D |
| Horizontal sharding / millions-scale benchmarks | Performance hardening after v2 ship |

---

## 19. Implementation phases

### Phase A — Metadata foundation (1–2 weeks)

**Exit criteria:** Builder driven by API; no hardcoded field lists; v2 AST schema validated.

**Status:** ✅ Done (2026-06-30)

- [x] `marketingAudienceMetadataService.js`
- [x] `GET /api/marketing/segments/metadata`
- [x] Extend `MarketingSegment` model (`primaryEntity`, `filterQueryVersion`)
- [x] v2 AST validation (field rules on primary entity only — no relationships yet)
- [x] Client: `useMarketingAudienceMetadata`; refactor `SegmentBuilder.vue`
- [x] Legacy segment backward compatibility
- [x] Tests: metadata per tenant; validation rejects unknown fields

### Phase B — Single-hop relationships (2–3 weeks)

**Exit criteria:** PDF example “Healthcare org + Closed Won deal” works with one hop per condition block.

**Status:** ✅ Done (2026-07-01)

- [x] `marketingAudienceQueryCompiler.js` — FK + `RelationshipInstance` one hop
- [x] `AudienceRelationshipRule` + `AudienceAggregateRule` (exists / not_exists)
- [x] Contact resolution when primary ≠ people
- [x] Extended date/numeric/text operators in compiler
- [x] UI: relationship path picker (1 hop)
- [x] Preview insights: reachable, missing email, suppressed, duplicates
- [x] `POST /api/marketing/segments/explain`
- [x] Unit tests: people → org, people → deals link resolution

### Phase C — Multi-level relationships (2–3 weeks)

**Exit criteria:** 2–3 hop paths; aggregate count on related records.

**Status:** ✅ Done (2026-07-01)

- [x] Multi-hop path walker (e.g. people → org → deals → cases)
- [x] Depth validation (max 3 hops via `MARKETING_AUDIENCE_MAX_RELATIONSHIP_DEPTH`)
- [x] Aggregate rules: count, sum, avg with nested filter on related module (min/max server-side; UI exposes count/sum/avg)
- [x] UI: multi-hop path picker (“Add hop” breadcrumb)
- [x] Preview breakdown: organizations count, top industries
- [x] Performance: ID batching (`ID_BATCH_SIZE`), primary batching (`AGGREGATE_PRIMARY_BATCH_SIZE`), slow-query logging (>3s)
- [ ] Load test: 10k people, 2-hop path under 3s preview count — deferred to Phase D hardening

### Phase D — Enhancements (future)

- [ ] Engagement rules via `Communication` module
- [ ] Query plan cache (Redis)
- [ ] Audience versioning
- [ ] Static freeze from dynamic definition

---

## 20. Testing strategy

| Layer | Coverage | Status |
|-------|----------|--------|
| Unit | AST validation, leaf compile, single/multi-hop ID resolution, contact resolution | ✅ |
| Integration | HTTP preview/members/create with fixture org + relationships | Partial — controller tests; full HTTP fixtures deferred |
| Regression | Legacy v1 segments still compile and count correctly | ✅ via legacy fallback |
| Tenant isolation | Org A rules never return Org B people | Enforced by tenant context + review |
| Permissions | Metadata and preview respect `segments.view` | ✅ |

Fixture scenarios (minimum):

1. Primary field only (legacy parity)
2. People → Organization industry filter
3. People → Organization → Deal stage + date range
4. Aggregate: no open cases on org
5. Primary = Organization → resolves to contact emails
6. Suppressed email excluded from reachable count

---

## 21. Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `MARKETING_AUDIENCE_MAX_RELATIONSHIP_DEPTH` | `3` | Max hops in `relationshipPath` |
| `MARKETING_AUDIENCE_RECIPIENT_MAX` | `5000` | Max recipients resolved per send |
| `MARKETING_AUDIENCE_PREVIEW_SAMPLE_MAX` | `50` | Max sample rows in preview |
| `ENABLE_MARKETING_SEGMENT_REFRESH_SCHEDULER` | `true` | Background count refresh (existing) |

---

## 22. Success metrics

| Metric | Target |
|--------|--------|
| Marketer can build 2-hop audience without support | 100% in UAT |
| Preview count p95 | < 3s for tenant with ≤ 100k people |
| Zero hardcoded module fields in client | Enforced in code review |
| Legacy segments | 100% backward compatible |
| Campaign send | Same AMDS contract; reachable recipients ≤ total matches |

---

## 23. Document history

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-06-30 | Platform / Marketing | Initial spec — dynamic audience + multi-level relationships |
| 1.1 | 2026-07-01 | Platform / Marketing | Phases A–C shipped; updated current state, file map, checklists |

---

## Appendix A — File map (implemented)

| File | Status |
|------|--------|
| `server/models/MarketingSegment.js` | Extended (`primaryEntity`, `filterQueryVersion`, `explainSummary`) |
| `server/services/marketing/marketingAudienceMetadataService.js` | ✅ |
| `server/services/marketing/marketingAudienceQueryCompiler.js` | ✅ |
| `server/services/marketing/marketingAudienceLinkResolver.js` | ✅ |
| `server/services/marketing/marketingAudienceAggregateEvaluator.js` | ✅ |
| `server/services/marketing/marketingAudienceFieldCompiler.js` | ✅ |
| `server/services/marketing/marketingAudienceAstValidator.js` | ✅ |
| `server/services/marketing/marketingAudienceAstUtils.js` | ✅ |
| `server/services/marketing/marketingAudiencePreviewService.js` | ✅ |
| `server/services/marketing/marketingAudienceExplainService.js` | ✅ |
| `server/services/marketing/marketingAudienceForeignKeys.js` | ✅ |
| `server/services/marketing/marketingAudienceConstants.js` | ✅ |
| `server/services/marketing/marketingSegmentQueryService.js` | Refactored — delegates to query compiler |
| `server/controllers/marketingSegmentController.js` | Extended validation + insights |
| `server/routes/marketingSegmentRoutes.js` | metadata + explain routes |
| `client/src/composables/useMarketingAudienceMetadata.js` | ✅ |
| `client/src/components/marketing/AudienceRelationshipRulesPanel.vue` | ✅ |
| `client/src/views/marketing/SegmentBuilder.vue` | Major update |
| `client/src/utils/marketingAudienceFilterConfig.js` | ✅ (replaces hardcoded config) |
| `client/src/utils/marketingPeopleFilterConfig.js` | **Removed** |
| `docs/MARKETING_APPLICATION_ROADMAP.md` | M3.5 marked done; M4 next |

## Appendix B — Roadmap alignment

This spec defined **Phase M3.5 — Dynamic Audience Engine (relationship-aware)** between shipped M3 and M4.

M3 shipped People-only segmentation. **M3.5 is complete (2026-07-01).** M4+ (templates, scheduling) consumes audiences produced by this engine unchanged.

**Next roadmap phase:** [M4 — Email builder & template library](./MARKETING_APPLICATION_ROADMAP.md#phase-m4--email-builder--template-library)
