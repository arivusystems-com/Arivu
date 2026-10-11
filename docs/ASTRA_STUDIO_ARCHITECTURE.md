# Astra Studio — Architecture (Source of Truth)

> **Product shell:** Astra Studio  
> **Runtime:** Living Canvas (infinite multiplayer workspace)  
> **AI:** Astra v2 Mission Control + `canvas.*` tools  
> **Status:** Shipped Waves 0–5 foundation

## 1. Purpose

Astra Studio is Arivu’s AI-first collaborative workspace. Users describe intent; Mission Control generates a Living Canvas bound to live CRM data. CRM modules remain the system of record.

## 2. Layers

| Layer | Responsibility | Location |
|-------|----------------|----------|
| Canvas Engine | Pan/zoom, frames, selection, multiplayer cursors | `client/src/astraStudio/engine/` |
| Live Widget Engine | Typed widgets + CRM/analytics bindings | `client/src/astraStudio/widgets/` |
| Intent → type | Structured `CanvasIntent` (type, scope, entity, goals, timeRange) via LLM + heuristic | `server/services/astraStudio/canvasIntent.js`, `classifyCanvasType.js` |
| Hydrate policy | Per-type brief kind, fill gates, analytics/comms/tasks/web flags | `server/services/astraStudio/hydratePolicy.js` |
| Brief registry | Routes to party / org / account / case / project / abstract briefs | `server/services/astraStudio/canvasBriefRegistry.js` |
| AI Intelligence | `canvas.generate` / `mutate` / `suggest` / `export` | `server/services/astra/tools/canvasTools.js` |
| Specialist hydrate | Per-widget fill via Mission Control specialist seats (`surface: service`, never `astra-studio`) | `server/services/astraStudio/specialistWidgetFill.js`, `canvasHydrateService.js` |
| Situation brief | Party CRM 360 packet (related + activity + emails) | `server/services/astraStudio/canvasSituationBrief.js` → `situationContext.js` |
| Org executive brief | Tenant pipeline/revenue snapshot (no deal focus) | `server/services/astraStudio/orgExecutiveBrief.js` |
| Automation | Domain events → refresh + smart suggestions | `server/services/astraStudio/automationService.js` |
| Multiplayer | Yjs + Awareness over WebSocket + Redis fanout | `server/realtime/studioWsGateway.js`, `yjsRoomManager.js` |

### 2.1 Generate / hydrate pipeline

```text
User prompt
  → resolveCanvasIntent (scope + type + entityHint + goals)
  → getHydratePolicy(type, intent)
  → buildTemplateOps(type)                    // layout
  → resolveFocusFromPrompt (skipped for org/abstract)
  → buildBriefForCanvas(policy.brief)         // grounded packet
  → bind CRM widgets + seed analytics/timeline/comms/tasks per policy
  → specialist fill (allowed without party when policy.fillWithoutParty)
```

**Scopes:** `org` | `party` | `account` | `deal` | `case` | `project` | `abstract`  
**Accuracy rule:** LLM writes panel prose only after the brief/metrics executors run — never invent CRM amounts when the brief has none.

**Regression lock (empty boards / FOCUS=General):**  
`server/services/astraStudio/__tests__/customer360Focus.regression.test.js` — company names must resolve to `organizations`, not people. Run:

```bash
cd server && node --test services/astraStudio/__tests__/customer360Focus.regression.test.js
```

## 3. HTTP & Realtime

| Surface | Path |
|---------|------|
| REST | `/api/astra/studio/*` (`astraStudioRoutes.js`) |
| WebSocket | `/api/astra/studio/ws?token=&canvasId=` |
| Astra ask | `POST /api/ai/v2/ask` with `surface: 'astra-studio'` + `canvasId` |

### WS binary protocol

| byte0 | Payload |
|-------|---------|
| 0 | Yjs update |
| 1 | Awareness update |
| 2 | JSON data channel (`widget.refresh`, `suggestion.created`, `ready`) |

## 4. Data model (tenant DB)

- `AstraCanvas` — metadata, ACL, `yjsState` snapshot
- `AstraCanvasRevision` — immutable checkpoints
- `AstraCanvasSuggestion` — dismissible AI/automation suggestions
- `AstraCanvasComment` — anchored comments / approvals

Yjs doc shape: `root` → `widgets` (Y.Map), `sections` (Y.Array), `meta` (Y.Map).

## 5. Security

- Same Astra access gates as v2 (`requireAstraV2Access` + `ASTRA_STUDIO` flag)
- Canvas ACL: owner / editors / viewers / link-share token
- Viewers: Awareness allowed, Yjs writes rejected
- Widget-bound CRM data respects module record permissions at read time
- AI outputs inherit workspace permissions; turns audited via Astra governance

## 6. Flags

| Env | Default | Meaning |
|-----|---------|---------|
| `ASTRA_V2` | true | Parent AI platform |
| `ASTRA_STUDIO` | true | Studio product enablement |

## 7. Client routes

- `/astra-studio` — list + create-from-prompt
- `/astra-studio/:canvasId` — editor (palette, viewport, inspector, chat)

## 8. Templates

All PRD canvas types are registered in `server/services/astraStudio/templates/index.js` and seeded via `canvas.generate` / create-with-`generate`.

## 9. Export

`exportService` supports `html`/`pdf` (HTML snapshot), `docx`, `pptx`, `xlsx` (widget table JSON).

## 10. Performance

- Debounced Yjs persistence (~1.5s)
- Client viewport culling of off-screen widgets
- Progressive template fill (sections + widgets in one op batch; hydrate async)
- Specialist hydrate: concurrency 3, max 10 narrative widgets; checklist via `task-activity`; recursion guard = never call orchestrator with `surface: 'astra-studio'` from hydrate
- Situation brief: one `buildCanvasSituationBrief` (person/org related + activity + emails via `buildSituationContext`) shared across all specialist fills; seeds timeline/comms widgets

## 10a. Specialist widget map

| Widget | Specialist agent |
|--------|------------------|
| `ai.risk` | `deal-intelligence` |
| `ai.insights` | `relationship-intelligence` |
| `ai.summary` | `meeting-intelligence` |
| `ai.recommendations` | `deal-intelligence` |
| `ai.nba` | `workday-orchestrator` |
| `content.checklist` | `task-activity` |
| other narrative | `summary` |

Bodies stamped with `ai.specialist`; failures fall back to deterministic `fallbackBody`.

## 11. Tests

```bash
cd server && node --test services/astraStudio/__tests__/astraStudio.test.js
```

## 12. Related docs

- [`ASTRA_V2_ARCHITECTURE.md`](./ASTRA_V2_ARCHITECTURE.md)
- [`Architecture_Document.md`](./Architecture_Document.md)
