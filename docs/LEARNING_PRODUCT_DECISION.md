# Learning App — Product & Commercial Decision (Locked)

> **Status:** Locked · **App key:** `LMS` · **Display name:** Learning  
> **Do not** treat Learning as an addon or “LMS add-on.”  
> **V1 / V1.1:** COMPLETE · FROZEN — no major internal LMS features before Academy MVP.  
> **V2 next:** Learning Academy (external experience on the shared Learning domain). Spec: [`LEARNING_PORTAL_ACADEMY_V2.md`](./LEARNING_PORTAL_ACADEMY_V2.md).

## Architecture

Learning is a **first-class Arivu App** on the shared platform (Identity, RBAC, People, Billing, Notifications, Files, Audit, i18n).

```
                    ARIVU LEARNING
                         │
             ┌───────────┴───────────┐
             │                       │
       LEARNING APP             LEARNING ACADEMY
        Internal                  External
         /learning                  /academy
             │                       │
             └───────────┬───────────┘
                         │
                  SAME LEARNING DOMAIN
         Courses · Paths · Programs · Enrollment
         Progress · Assessment · Certificates · Events
                         │
                    Shared Seats
              (audience breakdown = analytics)
```

| Term | Meaning |
|------|---------|
| **Learning** | Arivu app/domain (`APP_KEYS.LMS`) |
| **Learning App** | Internal experience (`/learning`) — employees, authors, admins, managers |
| **Learning Academy** | Tenant external learning destination |
| **Academy learner** | EXTERNAL learner |
| **`/academy/*`** | Academy experience (technical surface) |
| **`/portal/*`** | Existing CRM stakeholder portal — **unchanged** |

Phase name in roadmap docs may remain “Learning Portal & Academy”; day-to-day product language prefers **Academy**.

```
Arivu user → Learning access → Learner seat → Active enrollment(s)
```

- **Learning access** — may enter Learning / Academy (`appAccess.LMS` ACTIVE, or ACTIVE Academy access for EXTERNAL)
- **Learner seat** — billable capacity unit (`capacity_unit = LEARNER_SEAT`)
- **Active enrollment(s)** — many courses/paths per learner; still **one seat**

## Commercial model

| Field | Value |
|-------|--------|
| `billing_model` | `TIERED_CAPACITY` |
| `capacity_unit` | `LEARNER_SEAT` |
| Product code | `learning_app` |
| Primary plan | Growth · 200 seats · ₹5,999/mo |

| Tier | Learner seats | Monthly |
|------|---------------|---------|
| Starter | 50 | ₹1,999 |
| Growth | 200 | ₹5,999 |
| Business | 500 | ₹11,999 |
| Enterprise | 500+ | Custom |

Annual ≈ 10× monthly. MAU is analytics/expansion only — **never** invoice quantity.

### Seat rules (locked)

Centralize in `LearningSeatService` — never bury in Enrollment or Academy login.

- **1 learner = 1 seat**, regardless of enrollment count
- **One shared `LEARNER_SEAT` pool** for internal + Academy learners (`learning_app`)
- Seat **consumed** when: Learning access **AND** ≥1 seat-consuming enrollment (`active` | `completed`)
- Seat **released** when: zero seat-consuming enrollments **OR** Learning / Academy access revoked/suspended
- Logging into Academy alone does **not** consume a seat
- Completing one course does **not** release the seat if other seat-consuming enrollments remain
- At capacity: reject **new** billable seats only; existing learners uninterrupted
- Instructors/admins do not consume seats unless also learners

### Audience classification (not identity type)

Do **not** make Customer / Partner permanent identity types on `User`.

```
Learner
├── Internal
└── External
    ├── Customer
    ├── Partner
    └── Other / External
```

- Classification is **derived** centrally (People / org relationship + external role / portal type)
- Not stored as hard-coded fields on Enrollment
- A person may move Customer → Partner without changing `userType: EXTERNAL`
- `getUsageBreakdown()` returns `{ internal, customer, partner, external }` for **analytics only** — still **one** capacity pool for billing

## Content model (V1 — frozen)

```
Course → Module → LearningObject (TEXT | VIDEO | DOCUMENT | SCORM | LTI)
```

`LearningObject` is first-class so QUIZ, ASSIGNMENT, EMBED, AUDIO can extend later. **No second authoring UI** for Academy.

## Progress

Learning Events → Progress/completion projection (+ UI cache) → Analytics. Events are the reliable history.

## Navigation

**Learning App (`/learning`):** Home · My Learning · Explore · Courses · Learning Paths · Programs · Live Sessions · Assessments · Certificates · Skills & Badges · Content Library · Compliance · Analytics · Settings

**Learning Academy (`/academy`):** Home · Catalog · My Learning · Certificates · Profile — Learning-only; **no CRM nav**

## V1 core loop (quality bar — met)

Author → Course → Modules → LearningObjects → Publish → Enroll (seat check) → Learn → Progress → Assessment → Certificate → Analytics

### Merge checklist (LMS)

| Item | Status |
|------|--------|
| i18n (`learning.*`, onboarding first-time keys) | Done |
| FIRST_TIME empty (Home + Courses) | Done |
| Module visit tracking (`learning_home`, `learning_courses`) | Done |
| PostHog (`posthogLearning.ts` + core-loop events) | Done |
| Permissions / role guards (LEARNER · AUTHOR · ADMIN) | Done |
| Empty-state classification (FIRST_TIME vs NO_DATA) | Reviewed |
| Platform Home | N/A for V1 (Learning uses special `/learning` shell) |

## Scope status

| Phase | Status |
|-------|--------|
| **V1** Multi-tenancy, RBAC, Courses/Modules/LOs, Enrollment, Progress, Paths, Quiz, Certificates, shells, Search/Notifications, analytics + seats | **COMPLETE · FROZEN** |
| **V1.1 interop** (below) | **LANDED · Implemented** |
| **V2 Learning Academy** | **NEXT** — see [`LEARNING_PORTAL_ACADEMY_V2.md`](./LEARNING_PORTAL_ACADEMY_V2.md) |
| Public/paid academy, LTI 1.3 / xAPI, separate academy spaces | **Future** (documented only) |

### Post-V1.1 interop (Implemented)

| Slice | Status |
|-------|--------|
| Commercial Learning plan selection | **Implemented** |
| Assignments + due dates | **Implemented** |
| File upload for VIDEO/DOCUMENT | **Implemented** |
| Manager / compliance views | **Implemented** |
| Programs / cohorts | **Implemented** |
| Live Sessions | **Implemented** |
| Skills & Badges | **Implemented** |
| Automation hooks | **Implemented** |
| Contextual Learning (Cases + Deals) | **Implemented** |
| Learning AI (Astra + recommend) | **Implemented** |
| SSO/SCIM via Identity; SCORM iframe + LTI 1.1 launch | **Implemented** |

### Explicit non-goals (until Academy MVP ships)

- Second LMS / duplicate Course model
- CRM `/portal` modules as the Academy UX
- Separate portal seat SKU
- Customer/Partner as permanent User identity types
- Seat consumption on Academy login alone
- More major internal LMS features before Academy MVP

## Portal ↔ Academy — locked invariant

> **Status: LOCKED** — architectural / UX invariant, not an MVP experiment.  
> Applies to all EXTERNAL users who may hold Portal and/or Academy access.

**Model:** two surfaces, one identity, explicit switching, **independent authorization**.

| Surface | Path | Authorization source |
|---------|------|----------------------|
| Customer / stakeholder Portal | `/portal/*` | Portal app + external role assignments |
| Learning Academy | `/academy/*` | `LearningAcademyAccess` (+ LMS LEARNER when Active) |

**Hard rules**

1. **One Person / one EXTERNAL User** — never a second user record for Academy.
2. **No second LMS** — Academy reuses the Learning domain.
3. **No combined Customer Home** — do not invent a third shell that merges Portal + Academy.
4. **No Academy inside `/portal`** — Academy is never a Portal module or CRM chrome child.
5. **No CRM chrome inside `/academy`** — Academy uses Learning-only shell (`hideShell`); PlatformShell / CRM nav must not wrap it.
6. **Independent entitlements** — presence of one does **not** grant or revoke the other:
   - Removing Portal access → does **not** remove Academy access
   - Suspending / revoking Academy → does **not** remove Portal access
   - Removing a Portal Customer (or other) role → does **not** delete the Person
   - Academy access is managed **only** through `LearningAcademyAccess` (invite → accept → active → suspend/revoke → restore)
7. **Explicit switching** — dual-entitled learners move between `/portal` and `/academy` via links / post-login routing, not a unified nav chrome.

**Post-login preference (when both entitled):** Portal as operational default after portal role resolution; Academy-only users land on `/academy`.

## Dogfood

**Arivu Academy** — internal Learning tenant for employee onboarding (Learning App). External Academy is the V2 product surface.

```bash
cd server && npm run seed:learning-academy
# or: node scripts/seedArivuAcademyLearning.js --orgSlug=arivu-systems
```
