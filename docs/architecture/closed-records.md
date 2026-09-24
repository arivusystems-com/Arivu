# Closed Records

Core Platform capability: **Status** (business picklist value) and **Lifecycle State** (`active` | `closed`) are separate. Closed is lifecycle metadata applied to existing status/stage values — not a new status value.

## Configuration UI

**Module settings → Closed States** (last top tab on eligible modules).

Path examples:
- Settings → Apps → Core Modules → Task → **Closed States**
- Settings → Applications → Sales → Sales Modules → Deal → **Closed States**
- Settings → Applications → Helpdesk → Cases → **Closed States**

Implemented in `ModulesAndFields.vue` (`id: closed-states`), embedding `ClosedRecordsSettings` with `hideModuleSelector`.

## Storage

- Tenant model: `ClosedRecordsConfig` (`moduleKey`, `enabled`, `statusField`, `closedStates[]`, `reopenEnabled`, `allowLinkingToClosed`)
- Record fields: `lifecycleState`, `closedAt`, `reopenedAt`

## Engine

| Piece | Path |
|-------|------|
| Module registry + defaults | `server/constants/closedRecordsModules.js` |
| CRUD / evaluate / reopen | `server/services/closedRecordsService.js` |
| Write guard | `server/services/closedRecordsWriteGuard.js` |
| Linking gate | `server/services/closedRecordsLinkingGuard.js` |
| Settings API | `GET/PUT /api/settings/closed-records/:moduleKey` |
| Reopen | `POST /api/settings/closed-records/:moduleKey/:id/reopen` (+ module routes e.g. deals/cases) |

## Deal contract

Closed States annotate **Stage**. Platform **Status** remains `Open` | `Won` | `Lost` (`STATUS_WRITE_PROTECTED`). Lifecycle Closed when Stage ∈ configured Closed States.

## Domain events / Process Designer

- Emit: `{module}.closed`, `{module}.reopened`
- Core triggers: `record_closed`, `record_reopened`
- Existing `includeClosedRecords` / `shouldSkipClosedRecord` prefer Closed Records config
