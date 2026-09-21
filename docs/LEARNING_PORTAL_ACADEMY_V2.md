# Learning Academy V2 — MVP Spec

> **Status:** Locked for MVP engineering  
> **Product language:** Learning Academy  
> **Technical surface:** `/academy/*`  
> **Domain:** Shared Learning (`APP_KEYS.LMS`) — not a second LMS  
> **Parent decision:** [`LEARNING_PRODUCT_DECISION.md`](./LEARNING_PRODUCT_DECISION.md)

## 1. Purpose

Ship an **external Academy experience** on top of the Learning system already shipped. Authors and admins stay in the **Learning App** (`/learning`). External learners use **Academy** (`/academy`).

`/portal/*` remains the CRM stakeholder portal and is **unchanged**.

## 1b. Portal ↔ Academy — locked invariant

> **LOCKED** — see also [`LEARNING_PRODUCT_DECISION.md`](./LEARNING_PRODUCT_DECISION.md) § Portal ↔ Academy.  
> Not an MVP experiment.

**Two surfaces, one identity, explicit switching, independent authorization.**

- No combined Customer Home
- No Academy inside `/portal`
- No CRM chrome inside `/academy`
- No second user record
- No second LMS

**Entitlement independence (required):**

| Action | Must NOT imply |
|--------|----------------|
| Remove Portal access | Remove Academy access |
| Suspend / revoke Academy | Remove Portal access |
| Remove Portal Customer (or other) role | Delete the Person |
| Grant Portal role | Grant Academy access |
| Grant Academy invite | Grant Portal access |

Academy access lifecycle is owned exclusively by **`LearningAcademyAccess`**. Portal access is owned by Portal / external role assignment. Shared glue = one Person + `userType: EXTERNAL`; audience (Customer / Partner / External) is **derived**, not a second identity.

## 2. Terminology

| Term | Meaning |
|------|---------|
| Learning | Arivu app/domain |
| Learning App | Internal `/learning` |
| Learning Academy | Tenant external learning destination |
| Academy learner | `userType: EXTERNAL` with Academy + LMS LEARNER entitlement |
| `/academy/*` | Academy UX |
| `/portal/*` | CRM portal (out of scope for Academy UX) |

## 3. MVP scope

### In

- Tenant Learning Academy configuration (enable, name, branding subset, catalog visibility, allowed audiences)
- `/academy/*` Learning-only shell: Home · Catalog · My Learning · Certificates · Profile
- Shared `LEARNER_SEAT` pool; audience-derived usage breakdown for analytics
- Audience-scoped catalog (Customer / Partner / External within **one** Academy)
- Access lifecycle: Invite → Accept → Active → Suspend/Revoke → Restore
- Server-side EXTERNAL security boundary (deny authoring/admin/compliance/settings/content-library/internal analytics)
- Admin flow: Person → grant Academy/LMS access → assign → invite → learner accepts → `/academy` → learn → certificate

### Out (Phase 2+)

- Separate academy spaces / three product academies as separate tenants
- Public self-registration / paid catalog
- V2 Intelligence (CS unfinished-onboarding)
- V3 deeper contextual Learning in CRM
- LTI 1.3 / xAPI / enterprise governance

## 4. Audience model

MVP = **one tenant Academy** with audiences (not three academies):

```
Tenant
  └── Academy
       ├── Customer audience
       ├── Partner audience
       └── External audience
```

Audience is **derived** (People/org + external role / portal type). Not a permanent User identity type. Not enrollment fields.

`getUsageBreakdown()` → `{ internal, customer, partner, external }` — analytics only; billing remains one pool.

## 5. Academy configuration schema

Owner = **Learning** (not CRM Portal branding). May reuse org branding primitives underneath.

```js
Organization.settings.learningAcademy = {
  enabled: Boolean,                 // default false
  name: String,                     // display name
  logoUrl: String | null,
  faviconUrl: String | null,
  primaryColor: String,             // default '#3a1f8a'
  secondaryColor: String | null,
  customDomain: String | null,      // MVP may store; routing later
  catalogVisibility: 'assigned' | 'audience' | 'invite_only',
  allowedAudiences: Array<'customer' | 'partner' | 'external'>,
}
```

MVP implements: `enabled`, `name`, `logoUrl`, `primaryColor`, `secondaryColor`, `catalogVisibility`, `allowedAudiences`. Custom domain / favicon may be stored and unused until later.

Per-course optional override (MVP):

```js
LearningCourse.academyVisibility = 'inherit' | 'assigned' | 'audience' | 'invite_only'
LearningCourse.academyAudiences = ['customer' | 'partner' | 'external']  // when audience
```

## 6. Seat invariants

| Event | Seat effect |
|-------|-------------|
| Academy login alone | **No** consume |
| Learning access + ≥1 seat-consuming enrollment | Consume |
| Zero seat-consuming enrollments | Release |
| Suspend / revoke Academy/Learning access | Release (access gate fails) |
| Complete one course, others remain | **No** release |

Seat-consuming enrollment statuses: `active`, `completed` (existing `SEAT_CONSUMING_ENROLLMENT_STATUSES`).

## 7. Access lifecycle

```
Invited → Active → Suspended / Revoked → (Restore → Active)
```

| Action | Effect |
|--------|--------|
| Invite | `LearningAcademyAccess.status = invited`; invitation sent; Person retained |
| Accept | `status = active`; learner may use `/academy` |
| Suspend | `status = suspended`; LMS effective access off; seat releases if no longer consuming |
| Revoke | `status = revoked`; **Person not deleted** |
| Restore | `status = active` again |

Source of truth: `LearningAcademyAccess` collection. Sync effective LMS LEARNER for EXTERNAL sessions when ACTIVE.

## 8. Security boundary (MVP required)

Academy / LMS APIs for EXTERNAL must enforce **server-side**:

- `userType === EXTERNAL`
- ACTIVE Academy access + LMS LEARNER entitlement
- Tenant isolation

EXTERNAL must **never** receive (even if URL guessed):

- Authoring (create/edit/publish courses, paths, programs, LOs, upload)
- Administration / Learning Settings mutations
- Internal analytics, compliance reports
- Content library admin APIs
- Tenant settings

UI hiding is **not** a security boundary. Middleware deny-list on `/api/lms/*` for EXTERNAL.

Internal users hitting `/academy` → redirect to `/learning`. EXTERNAL hitting `/learning` author/admin routes → redirect to `/academy`.

## 9. Catalog visibility

| Mode | EXTERNAL catalog shows |
|------|------------------------|
| `assigned` | Published courses with active assignment/enrollment for the learner |
| `audience` | Published courses whose `academyAudiences` includes learner’s derived audience (and tenant allows that audience) |
| `invite_only` | Only explicitly assigned (same as assigned for MVP listing) |

## 10. End-to-end success flow

```
Admin (Learning App)
  → Create / identify external Person
  → Grant Academy + Learning access
  → Assign Course / Path / Program
  → Invite learner
  → Learner accepts
  → /academy
  → Catalog / My Learning
  → Learn → Progress → Assessment → Certificate
```

## 11. Acceptance criteria

- [ ] EXTERNAL learner completes invite → academy → certificate on shared Learning domain
- [ ] Seat capacity shared; login alone does not bill a seat; revoke/release behaves correctly
- [ ] Usage shows Internal / Customer / Partner / External breakdown (analytics)
- [ ] Academy APIs refuse authoring/admin/settings for EXTERNAL (server-tested)
- [ ] Authors only in Learning App; Academy shows content by assignment/audience
- [ ] Docs match: V1 frozen, interop implemented, Academy = next phase

## 12. Explicit non-goals

- Second LMS / duplicate Course model
- CRM `/portal` as Academy UX
- Separate portal seat SKU
- Customer/Partner as permanent User identity types
- Seat consumption on Academy login alone
- More internal LMS features before this MVP ships
