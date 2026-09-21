# External User / Portal Framework — Architecture Spec

> **Status:** Approved — ready for engineering execution  
> **Scope:** Platform-wide external stakeholder access (customers, partners, vendors, dealers, contractors, auditors)  
> **Aligned with:** `Architecture_Document.md`, `RBAC_PROFILES_SHARING.md`, `people-surface-invariants.md`, `organization-surface-invariants.md`  
> **Implementation plan:** [`EXTERNAL_USER_PORTAL_IMPLEMENTATION_PLAN.md`](./EXTERNAL_USER_PORTAL_IMPLEMENTATION_PLAN.md)

---

## 1. Purpose

Enable external stakeholders to securely access Arivu through **configurable external roles** (portals). Portal access is **platform-wide** — not tied to a single application shell — though the **PORTAL app** is the default UX container for external users.

**Learning Academy (separate surface):** External **learning** uses `/academy/*` on the shared Learning (`LMS`) domain — not CRM portal modules. Same EXTERNAL identity + People master; LMS LEARNER + Academy access lifecycle. Spec: [`../LEARNING_PORTAL_ACADEMY_V2.md`](../LEARNING_PORTAL_ACADEMY_V2.md). `/portal` remains CRM stakeholder UX.

**Baseline requirement doc:** Customer-provided functional spec (External User / Portal Framework). This document resolves ambiguities against the existing codebase and locks architectural decisions.

---

## 2. Locked decisions

| Decision | Resolution |
|----------|------------|
| Multi-role model | `User.externalRoleAssignments[]` + session `activeExternalRoleId` (**external users only**) |
| Session permissions | `activeExternalRoleId` in JWT; hydrate `req.user` in memory — **do not persist `roleId` on external users** |
| External user storage | Extend `User`; **no** separate `ExternalUser` collection |
| AUDIT external users | Same portal framework; **Auditor** is an external role (`userType: EXTERNAL`) |
| Org eligibility | **Configurable** per tenant via `portalEligibility` settings (not hardcoded status names) |
| Audit trail | Platform **`SecurityEvent`** model + `securityAuditService` — no `PortalAuditLog` collection |
| MVP scope | **Multi-portal from day one** (selection + switcher) |
| Licensing V1 | **Usage collection only** — seat enforcement deferred to V1.5 |
| SSO | **Hooks in schema now**; OIDC/SAML implementation deferred to V2 |

---

## 3. Core principles

1. **People is the master identity** — portal users are always created from People records; no duplicate identities.
2. **Portal = External Role** — not a separate object. Examples: Customer Portal, Partner Portal, Vendor Portal, Auditor Portal.
3. **Single login** — internal and external users share the same login URL and auth engine.
4. **Multiple portals per user** — one login, one external user; many external roles allowed.
5. **Roles drive everything** — apps, modules, actions, record/field/layout visibility, widgets, dashboards, processes.
6. **Organization controls access** — business org ineligible → external users inactive, sessions terminated.
7. **API = UI** — permissions enforced identically on UI, API, and deep links; unauthorized → `403`.

---

## 4. RBAC exception: external multi-role

`RBAC_PROFILES_SHARING.md` defines **one role per internal user**. External users are the **only exception**.

| User type | Role assignment | Runtime |
|-----------|-----------------|---------|
| `INTERNAL` | Single persisted `User.roleId` | Unchanged |
| `EXTERNAL` | `User.externalRoleAssignments[]` (1..n) | Session `activeExternalRoleId` only |

**Source of truth for external role membership:** `externalRoleAssignments[]`. External users **must not** have a persisted `roleId` used for authorization.

### Session hydration (request-time, in-memory only)

On login, portal select, portal switch, and every authenticated request:

```
JWT.activeExternalRoleId
  → validate membership in externalRoleAssignments[]
  → load Role (userType=EXTERNAL)
  → applyProjectionToUser(req.user, roleLean)   // in-memory: permissions, appAccess, fieldPermissions
  → apply sharingResolver for external tree
  → never User.save() for roleId / appAccess on external users
```

**Implementation touchpoints:**

- `authSessionService.generateToken` — include `activeExternalRoleId` in JWT payload for external users
- `resolveUserFromToken` — pass claim through to `req.user`
- `hydrateUserPermissionsFromRole` — branch: external users resolve from `activeExternalRoleId`, not `user.roleId`
- `externalRoleSessionService.hydrateExternalUserSession(user, activeExternalRoleId)` — single entry for projection

---

## 5. Conceptual model

```
People (master identity)
  │ organization → Business Organization (SALES org, isTenant=false)
  │ portalAccess { enabled, userId, … }
  ▼
User (userType=EXTERNAL, peopleId, status)
  │ externalRoleAssignments[] → Role (userType=EXTERNAL) × n
  │ defaultExternalRoleId (persisted preference)
  │ activeExternalRoleId (JWT / session only)
  ▼
Runtime permissions + sharing filter + PORTAL (and cross-app) shell
```

**Status source of truth:** `User.status` (`active` | `inactive` | …). People widget reads linked User — no duplicated status on People.

**PORTAL app vs platform-wide access:** External roles grant entitlements across apps (SALES cases/quotes, documents, forms, AUDIT execution, etc.). The **PORTAL app** is the navigation shell; **permissions are role-driven**, not `/portal/*`-scoped.

**AUDIT external users:** Auditors are external users with an Auditor external role. Same enablement, login, portal selection, and session machinery.

---

## 6. Data models

### 6.1 People — portal access block

Portal enablement is **optional** and controlled from People. Platform capability on identity — not a participation field.

```javascript
// people.portalAccess
{
  enabled: Boolean,                    // default false
  userId: ObjectId | null,             // ref User — set on first enable
  enabledAt: Date,
  enabledBy: ObjectId,                 // ref User (internal)
  disabledAt: Date | null,
  disabledBy: ObjectId | null,
  lastSyncedAt: Date                   // last org-eligibility sync
}
```

**No `portalAccess.status`** — derive display status from linked `User.status`.

**People tagging:** **External User** badge when `portalAccess.enabled === true`.

**Deletion guard:** People **cannot be trashed/deleted** while `portalAccess.enabled === true`.

### 6.2 User — external user extensions

```javascript
{
  userType: 'EXTERNAL',
  organizationId: ObjectId,
  email, username, password,
  status: 'active' | 'inactive' | 'suspended' | 'invited',  // source of truth

  peopleId: ObjectId,                  // required for EXTERNAL; unique per tenant

  externalRoleAssignments: [{
    roleId: ObjectId,
    status: 'ACTIVE' | 'INACTIVE',
    assignedAt: Date,
    assignedBy: ObjectId,
    removedAt: Date | null,
    removedBy: ObjectId | null
  }],

  defaultExternalRoleId: ObjectId | null,

  portalInvite: {
    inviteVersion: Number,
    tempPasswordIssuedAt: Date,
    tempPasswordUsedAt: Date | null
  },

  authProvider: {                      // V2 SSO
    type: 'local' | 'oidc' | 'saml',
    externalSubjectId: String,
    idpConnectionId: ObjectId,
    lastSsoLoginAt: Date
  }

  // roleId: NOT used for EXTERNAL users (omit or leave null)
}
```

**Indexes:** `{ organizationId, peopleId }` unique sparse; `{ organizationId, userType, status }` for usage metrics.

### 6.3 Role — external portal roles

Standard `Role` with `userType: 'EXTERNAL'`. External tree root — never under internal hierarchy.

Default external denials (profile templates): delete, mass delete, send email, import, administration. Export configurable.

### 6.4 Audit — platform SecurityEvent (not PortalAuditLog)

Use the platform **`SecurityEvent`** model (tenant-scoped, append-only). Wire via **`securityAuditService`** (extends patterns from `securityLogger` + `DocumentAuditEvent`).

```javascript
// SecurityEvent — portal events use type prefix or category: 'portal'
{
  organizationId: ObjectId,
  type: String,           // portal_enabled | portal_disabled | portal_login | portal_login_failed |
                          // portal_role_assigned | portal_role_removed | portal_selected |
                          // portal_switched | portal_invite_sent | portal_password_reset | …
  description: String,
  userId: ObjectId | null,        // subject external user
  peopleId: ObjectId | null,
  actorUserId: ObjectId | null,   // admin or self
  ipAddress: String,
  metadata: Mixed,
  timestamp: Date                 // immutable — no updatedAt
}
```

**Login history:** `GET /api/people/:id/portal/audit` queries `SecurityEvent` filtered by `peopleId` + portal types.

**Do not** embed portal lifecycle in `People.activityLogs` — use SecurityEvent for admin audit; activityLogs remain CRM activity only.

---

## 7. Organization portal eligibility (configurable)

Resolved by **`organizationPortalEligibilityService`** — single authority. Rules are **tenant-configurable**, not hardcoded status string literals.

### 7.1 Configuration storage

Stored in `TenantModuleConfiguration.settings.portalEligibility` (organizations module config), alongside existing `statusTypes`:

```javascript
{
  portalEligibility: {
    // Which organization types support portal access at all
    supportedOrganizationTypes: ['Customer', 'Partner', 'Vendor', 'Dealer', 'Contractor', 'Auditor'],

    // Per org-type: which status field + which picklist values qualify
    rules: [
      {
        organizationType: 'Customer',       // matches Organization.types[] (case-insensitive)
        statusFieldKey: 'customerStatus',   // field on business Organization document
        eligibleStatusValues: []            // empty = derive from picklist portalEligible flags (preferred)
      }
    ],

    // Preferred: mark picklist values in statusTypes.statusPicklists.*.portalEligible
    usePicklistPortalEligibleFlags: true
  }
}
```

**Picklist extension (Settings → Organization Status Types):** Each status picklist value may include `portalEligible: boolean`. Eligibility service reads tenant `statusTypes` config and resolves:

1. Person's business org has a supported type in `types[]`
2. Org's current status value for the mapped field has `portalEligible: true` (or is listed in `rules[].eligibleStatusValues`)

**Default seed:** Sensible defaults on org creation (e.g. Customer `Active`, Partner `Active`, Vendor `Approved`) — tenants may reconfigure without code changes.

### 7.2 Eligibility API

```javascript
resolvePortalEligibility(businessOrg, tenantConfig) → {
  eligible: boolean,
  reason: string | null,
  matchedOrganizationType: string | null,
  statusFieldKey: string | null,
  statusValue: string | null
}
```

**Sync hooks:** Business org update → `portalAccessService.syncFromOrganizationChange(orgId)` when eligibility fails.

---

## 8. Portal enablement

### 8.1 Preconditions

- ✓ People `email` exists
- ✓ Email unique within tenant
- ✓ People `organization` (business org) exists
- ✓ `resolvePortalEligibility()` → `eligible: true`
- ✓ At least one external role selected
- ~~External user seat available~~ — **V1.5** (V1: no block)

### 8.2 Enable / disable flows

Unchanged logically. Audit via `securityAuditService.recordPortalEvent(...)`.

Disable: `People.portalAccess.enabled = false` → `User.status = inactive` → terminate sessions.

---

## 9. Invitation & first login

Reuse `userInviteService`, `userAccountEmailService`, `generateSecurePassword`. Unchanged from prior spec.

---

## 10. Login & portal session

JWT payload for external users **must include**:

```javascript
{
  id, organizationId,
  activeExternalRoleId,   // required after portal selection
  userType: 'EXTERNAL'
}
```

Portal select/switch issues **new token** with updated `activeExternalRoleId`.

---

## 11. Session management

Source: `Organization.settings.security.sessionPolicy`. Terminate on disable, org ineligible, password reset, last role removed, admin action.

---

## 12. Licensing & usage (V1 vs V1.5)

### V1 — collect usage only

- Metric: count of `userType=EXTERNAL` + `status=active` + linked `People.portalAccess.enabled=true`
- Expose: `GET /api/settings/billing/external-user-usage` (or admin dashboard widget)
- Store rolling count on tenant org: `usage.externalUsers.active` (updated on enable/disable/status change)
- **Do not block** enablement when over limit

### V1.5 — enforce seats

- `limits.externalUserSeats` on tenant Organization
- Block enablement at limit
- Billing integration

**Product rule (unchanged):** One active external user = one license; role count irrelevant.

---

## 13. People — External Access widget

**Display:** Portal enabled, External User ID (`User._id`), **User.status**, assigned roles, default portal, last login

**Actions:** Enable, Disable, Assign/Remove Roles, Reset Password, Resend Invitation, View Login History, Terminate Sessions

---

## 14. Admin operations

| Operation | Audit type (SecurityEvent) |
|-----------|---------------------------|
| Enable | `portal_enabled` |
| Disable | `portal_disabled` |
| Role assign/remove | `portal_role_assigned` / `portal_role_removed` |
| Login / switch | `portal_login` / `portal_switched` |
| Invite / reset | `portal_invite_sent` / `portal_password_reset` |

---

## 15. API security

Standard runtime chain unchanged. External users hydrated from `activeExternalRoleId` before permission checks.

---

## 16. Edge cases

Unchanged from baseline spec. Key additions:

| Scenario | Behavior |
|----------|----------|
| External user `roleId` in DB | Ignored; must be null for EXTERNAL users |
| JWT missing `activeExternalRoleId` | 401 `PORTAL_ROLE_REQUIRED` (multi-role) or auto-resolve single role |
| Tenant changes eligibility config | Re-evaluate linked People on next sync hook or admin "Recheck eligibility" |

---

## 17. SSO (V2)

`User.authProvider` hooks in V1. Implementation V2.

---

## 18. Feature flag

`PORTAL_FRAMEWORK_V1` — org-level or env flag.

---

## 19. Learning Academy vs CRM Portal

| Surface | Path | Purpose |
|---------|------|---------|
| CRM Portal | `/portal/*` | Stakeholder CRM UX (cases, knowledge, documents, …) |
| Learning Academy | `/academy/*` | Learning-only external experience |

Both use `userType: EXTERNAL` + People. Academy grants are tracked via `LearningAcademyAccess` and LMS LEARNER; CRM portal grants remain via portal enablement + external roles. Seat billing for Learning is the shared `LEARNER_SEAT` pool — not a separate portal SKU. See [`../LEARNING_PORTAL_ACADEMY_V2.md`](../LEARNING_PORTAL_ACADEMY_V2.md).

---

## 20. Non-goals (V1)

- Seat enforcement (V1.5)
- SSO/OIDC/SAML
- Custom domain, branding, delegated admin, bulk enablement, self-registration
- Using `/portal` modules as the Learning Academy UX
