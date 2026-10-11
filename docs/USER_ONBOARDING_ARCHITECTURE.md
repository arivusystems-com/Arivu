# User Onboarding Architecture

**Status:** v1 complete — **maintenance mode**. Not an active initiative.

**Scope:** First-run experience for all user acquisition paths — invited team members, self-serve website registration, and demo-request conversion.

**Last updated:** 2026-06-09

**Analytics:** See [ONBOARDING_ACTIVATION_ANALYTICS.md](./ONBOARDING_ACTIVATION_ANALYTICS.md) for PostHog events and funnel definitions.

**Change policy:** No P4 roadmap. No new onboarding mechanics unless PostHog funnel data, user interviews, support-ticket trends, or activation/retention metrics identify a specific bottleneck. Optimize using data — do not add features proactively.

**Before any onboarding-related change, review:**

- This document
- [ONBOARDING_ACTIVATION_ANALYTICS.md](./ONBOARDING_ACTIVATION_ANALYTICS.md)
- `.cursorrules` (Onboarding section)

### v1 production status (complete)

| Area | Status |
|------|--------|
| Founder onboarding (wizard) | ✅ |
| Invited-member onboarding (welcome + checklist) | ✅ |
| Platform Home onboarding | ✅ |
| FIRST_TIME empty states | ✅ |
| Coachmarks | ✅ |
| Sample data onboarding | ✅ |
| Trial activation flows | ✅ |
| PostHog instrumentation | ✅ |

**Explicitly out of scope (deferred):**

- Full-screen product tours / third-party walkthrough libraries
- Chatbot onboarding assistant
- Org-level billing setup during onboarding (trial remains trial)
- Non-owner admin onboarding for tenant configuration (uses founder track only when `isOwner`)

**Related contracts:**

- `client/src/types/empty-state.types.ts` — `EmptyStateType.FIRST_TIME`
- `docs/architecture/EMPTY_STATE_CONTRACT.md` — empty state data contract
- `server/services/platformHomeService.js` — Platform Home snapshot
- `server/services/onboardingService.js` — onboarding logic (single source of truth)

**Implementation note:** Personas are `founder` | `member` with app/role context on `onboarding.context`. Step progress uses structured `{ key, status, completedAt, skippedAt }` entries.

---

## 1. Goals

1. Every new user knows **why they are here** and **what to do first** within 3 minutes of first login.
2. **Invited users** reach their first meaningful action in their entitled app without a blocking wizard.
3. **Website signups (tenant founders)** stand up a usable workspace in one session (~10–15 min), with trial value visible in ~5 min.
4. Onboarding is **server-driven**, persona-aware, and measurable via PostHog.
5. Reuse existing surfaces: Platform Home, empty states, invite flow, notification system.

---

## 2. Acquisition Paths

| Path | API / entry | Who | Org state | `onboarding.origin` |
|------|-------------|-----|-----------|----------------------|
| **Invited** | `POST /api/users` + accept invite | Team member | Existing configured tenant | `invited` |
| **Self-serve register** | `POST /api/auth/register` | Tenant founder (owner) | New tenant, 15-day trial, SALES only, empty CRM | `self_serve` |
| **Demo converted** | `POST /api/demo` → admin conversion | Tenant founder (owner) | Provisioned tenant DB, seeded platform config, empty CRM | `demo_converted` |

### 2.1 Current gaps

| Path | Today |
|------|-------|
| Invited | Accept invite (password) → login → `/platform/home` with no first-run guidance |
| Self-serve | `RegistrationForm` → redirect to `{ name: 'dashboard' }` (stale route) → no setup flow |
| Demo | Form submission only; onboarding starts after activation email + set password |

Invited-user onboarding answers: **"What should I do in this org?"**

Founder onboarding answers: **"How do I make my org work?"**

These are different jobs. One engine, two persona templates.

---

## 3. Design Principles

| Principle | Rule |
|---|---|
| Time-to-first-win | Invited: < 3 min. Founder: < 5 min to first record or import. |
| Non-blocking (invited) | No full-screen wizard. Dismissible welcome + persistent checklist on Platform Home. |
| Guided setup (founder) | Dedicated `/onboarding` flow on first session. Steps individually skippable; flow resumable. |
| Role- and app-aware | Steps derived from `roleId`, `appAccess[]`, `isOwner`, permissions snapshot — not one-size-fits-all. |
| Server-driven | Checklist steps, completion signals, and copy keys returned by API. Client renders; client does not infer persona. |
| Reuse Platform Home | Onboarding checklist is a first-class section of the Platform Home snapshot alongside attention/resume. |
| Inviter as anchor | Invited flow references `{invitedBy}` and org context for personalization. |
| Empty is a state | Wire `EmptyStateType.FIRST_TIME` in module/list builders for first module visit. |
| Trial-aware | Self-serve founders see trial banner and limit context; no credit card during onboarding. |

---

## 4. Personas

Persona is computed server-side at invite/register/conversion time and refreshed on login if role changes.

```text
persona = founder | member
context = { primaryAppKey, roleKey, roleName, entitledAppKeys }
```

| Persona | Origin(s) | Primary surface |
|---------|-----------|-----------------|
| `founder` | `self_serve`, `demo_converted`, or `isOwner` (non-invited) | `/onboarding` wizard → Platform Home setup progress |
| `member` | `invited` | Platform Home welcome panel + personal checklist |

Checklist steps and primary CTA routes are derived from `context` (apps + role), not from sub-persona enums.

**Service:** `server/services/onboardingService.js` — single source of truth for persona resolution, step templates, completion, and API payloads.

---

## 5. Flow Overview

```text
                    ┌─────────────────────────────────────────┐
                    │           Acquisition entry              │
                    └─────────────────────────────────────────┘
                          │              │              │
                    invited          self_serve    demo_converted
                          │              │              │
                          ▼              ▼              ▼
                   accept-invite    register       activation email
                   (password)       (auto-login)   (set password)
                          │              │              │
                          ▼              └──────┬───────┘
                   first login                 ▼
                          │              /onboarding (founder wizard)
                          ▼                      │
                   Platform Home                  ▼
                   welcome + checklist      Platform Home
                          │              setup progress + trial banner
                          └──────────┬─────────────────┘
                                     ▼
                          per-app FIRST_TIME empty states
                                     ▼
                               steady state
```

---

## 6. Invited Member Track

### 6.1 Phase 0 — Invite (admin side)

Extend `InviteUserDrawer` with optional fields (all skippable by admin):

| Field | Purpose |
|-------|---------|
| Welcome note | Shown on accept-invite + first login |
| Suggested first action | Pre-assign a task, case, or deal |
| Primary app emphasis | Which app to land in after onboarding |

On invite send:

- Create a welcome notification for the invitee (visible on first login).
- Optionally create an assigned task (e.g. "Complete your profile" or admin-defined).
- Notify inviter when invite is accepted (via `invitedBy`).

### 6.2 Phase 1 — Accept invite (~60 sec)

Keep password setup. Add one lightweight screen after password (skippable):

- Profile essentials: timezone, locale (pre-filled from browser), optional avatar.
- Preview: entitled apps from `appAccess`.
- **Auto-login after accept** (skip second login) — recommended.

Do not ask about org config, integrations, or modules here.

### 6.3 Phase 2 — First login welcome (Platform Home)

Detect: `lastLogin == null` OR `onboarding.completedAt == null`.

Show a **WelcomePanel** on Platform Home (not full-screen modal):

```text
Welcome to {orgName}, {firstName}.
{InviterName} invited you as {roleName}.

You have access to: [Sales] [Helpdesk] [Inbox]

Your first step: {primaryStep based on persona}
[Go there]  [See checklist]  [Dismiss]
```

**Landing logic** (replace flat redirect to `/platform/home` for incomplete onboarding):

| Persona | Primary CTA |
|---------|-------------|
| Sales rep / manager | Assigned deals or People list |
| Helpdesk agent | Assigned cases or Inbox |
| Admin (non-owner) | Settings → Users or assigned modules |
| Multi-app user | Platform Home checklist (default) |

### 6.4 Phase 3 — Personal checklist (Platform Home)

Server-driven checklist in Platform Home snapshot:

```ts
interface OnboardingStep {
  key: string;           // 'complete_profile' | 'open_first_module' | ...
  labelKey: string;
  route?: string;
  completed: boolean;
  optional?: boolean;
}
```

**Core steps (3–5 max, persona-filtered):**

| Step | Who | Completion signal |
|------|-----|-------------------|
| Complete your profile | All | Avatar + timezone saved |
| Connect email | Mail-enabled roles | Mailbox connected |
| Review your first {module} | App-specific | Visited module route once |
| Take your first action | App-specific | Created/edited record OR completed assigned task |
| Set notification preferences | All | Visited notification prefs |

Rules:

- Collapsible; persists until complete or dismissed.
- Progress bar (e.g. 2/4).
- Re-openable from user menu → "Getting started".
- Dismiss sets `onboarding.dismissedAt`; do not re-show welcome; keep checklist accessible.

### 6.5 Phase 4 — Per-app contextual onboarding

Wire `EmptyStateType.FIRST_TIME` in module/list builders when:

- User's first visit to that app/module, AND
- Org has data OR user has assignments (otherwise show `NO_DATA` with create CTA).

**Lightweight coachmarks** (first visit only, once per surface, max 2–3):

- Sidebar: highlight entitled apps.
- Command palette hint (⌘K).
- Tab bar: records open in tabs.

Stored in `onboarding.coachmarksSeen[]`. No third-party tour library in v1.

### 6.6 Inviter loop

| Event | Action |
|-------|--------|
| Invite sent | Admin sees "Pending invite" in Users |
| Invite accepted | Notify inviter in-app |
| Onboarding complete | Notify inviter: "{Name} is ready" |
| Stalled 3+ days | Remind inviter to nudge or reassign |

---

## 7. Tenant Founder Track (Website Signup)

### 7.1 Self-serve register

**Signup form** — keep minimal:

| Collect at signup | Defer to onboarding |
|-------------------|---------------------|
| Name, email, password | Timezone, avatar |
| Company name | Pipeline stages, custom fields |
| Industry / vertical | Integrations, billing |

After register: **auto-login** → `/onboarding` (not `dashboard`).

Registration creates (existing behavior in `authController.registerUser`):

- Organization with `subscription.status: trial`, 15-day trial, SALES only
- Owner user with `isOwner: true`, `role: owner`
- Default roles

### 7.2 Demo request → conversion

Demo form (`/demo`) is lead capture only — no product access.

On admin conversion (`demoController`):

- Provision tenant DB + owner user with `status: invited` (no admin-set password)
- Tag `origin: demo_converted`
- Email the demo contact a **workspace activation** link (same accept-invite token path; founder copy)
- Owner sets their own password → first session → `/onboarding`
- Resend via `POST /api/demo/requests/:id/resend-activation` while still pending
- Carry `industry`, `companySize`, `message` into personalized copy
- Optionally pre-seed sample data from vertical template (P2)
- Optional "Your Arivu rep: {name}" card on Platform Home

If admin pre-configured during conversion, wizard steps already satisfied are skipped.

### 7.3 Founder setup wizard (`/onboarding`)

4–6 steps, individually skippable, resumable. Soft-block first session only.

#### Step 1 — Welcome + intent (~30 sec)

```text
Welcome to Arivu, {firstName}.
Let's set up {companyName} for {vertical}.

What do you want to do first?
○ Manage sales pipeline
○ Handle customer support
○ Run audits / inspections
○ Explore — show me everything
```

Stores `onboarding.goalKey`. Drives default app, checklist, sample data template, empty-state copy.

#### Step 2 — Workspace basics (~1 min)

- Timezone, currency, date format (pre-filled from browser/org defaults)
- Optional logo upload
- Confirm company name

Writes to `Organization.settings`.

#### Step 3 — Enable your first app (~1 min)

- Show entitled apps for trial tier
- Enable 1 primary app (respect seat/plan limits)
- If only SALES enabled (self-serve default): skip UI, show confirmation

Demo-converted tenants with apps already enabled: detect and skip.

#### Step 4 — First value action (3–5 min) — critical

| Intent / vertical | First win |
|-------------------|-----------|
| Sales (default) | Create first contact OR import CSV (≥3 rows) |
| Helpdesk | Create first case OR connect inbound email |
| Audit | Open sample assignment / form |
| Vertical-specific | Pre-selected module emphasis from `vertical` |

Options:

- Inline create drawer (minimal fields)
- Import wizard with downloadable sample CSV
- "Start with sample data" toggle (opt-in, clearly labeled, purge later) — P2

Completion: `first_record_created` or `import_completed`.

#### Step 5 — Invite teammate (optional, ~1 min)

Inline invite (reuse `InviteUserDrawer` fields). Skippable.

#### Step 6 — Platform Home

Founder Platform Home differs from invited users:

| Invited | Founder |
|---------|---------|
| "Welcome, {inviter} invited you" | "Your workspace is ready" |
| 3-step personal checklist | Setup progress card (org-level) |
| Assigned work | Trial banner (days left, limits) |

### 7.4 Founder setup progress (persists after wizard)

Org-scoped card on Platform Home, visible to owner/admin:

| Step | Completion |
|------|------------|
| Complete workspace profile | Org settings saved |
| Add first contact/deal/case | Record exists |
| Connect email | Mailbox connected |
| Invite a teammate | ≥1 active user besides owner |
| Import existing data | Import job completed |
| Explore settings | Visited `/settings` |

Progress: e.g. 3/6 complete. Dismissible after ≥4/6 or day 7.

Hidden for `invited_member` persona.

### 7.5 Trial-aware UX (self-serve only)

- Platform Home banner: **"{N} days left in trial · {used}/{max} contacts"**
- Checklist "Import data" links to import with limit context
- Email nudges: day 1 (finish setup), day 3 (no first record), day 7 (no invite)
- Upgrade CTA in setup card when approaching limits — not modal spam

### 7.6 Vertical personalization

Registration captures `vertical`. Server-side mapping:

```text
vertical → { primaryModules, sampleDataTemplate, checklistEmphasis, emptyStateCopyKeys }
```

Examples:

- Auditing Firms → AUDIT app, assignments, forms
- Real Estate → People + Deals + Organizations
- IT & SaaS Agencies → Deals pipeline + tasks

No new signup fields required.

### 7.7 Self-serve vs demo-converted

| Dimension | Self-serve | Demo converted |
|-----------|------------|----------------|
| Tone | Self-guided, trial urgency | "Your demo workspace is ready" |
| Data | Empty (unless sample opt-in) | Optional vertical sample seed |
| Sales touch | None | Optional rep card |
| Trial | 15-day, limits enforced | Tier set at conversion |
| Skip wizard | No — first login enters setup | Yes if admin pre-configured |

---

## 8. Routing

| Condition | Route |
|-----------|-------|
| `tenant_founder` + setup incomplete | `/onboarding` |
| `tenant_founder` + setup complete | `/platform/home` |
| `invited_member` + welcome unseen | `/platform/home?welcome=1` |
| Login (default) | `/platform/home` |
| Register success | Auto-login → `/onboarding` |

**Fix required:** `RegistrationForm.vue` currently redirects to `{ name: 'dashboard' }` — replace with onboarding guard logic above.

Router guard checks `GET /api/users/me/onboarding` or auth payload `onboarding` summary.

---

## 9. Data Model

### 9.1 User (`users`)

```js
onboarding: {
  version: { type: Number, default: 1 },
  origin: { type: String, enum: ['invited', 'self_serve', 'demo_converted', null] },
  persona: { type: String, enum: ['founder', 'member', null] },
  context: {
    primaryAppKey: String,
    roleKey: String,
    roleName: String,
    entitledAppKeys: [String]
  },
  goalKey: { type: String, enum: ['sales', 'support', 'audit', 'explore', null] },
  startedAt: Date,
  completedAt: Date,
  dismissedAt: Date,
  welcomeNote: String,
  steps: [{
    key: String,
    status: { type: String, enum: ['pending', 'completed', 'skipped'] },
    completedAt: Date,
    skippedAt: Date
  }],
  coachmarks: [{ key: String, seenAt: Date }]
}
```

### 9.2 Organization (`organizations`) — founder only

```js
onboarding: {
  setupCompletedAt: Date,
  sampleDataAccepted: { type: Boolean, default: false },
  steps: [{
    key: String,
    status: { type: String, enum: ['pending', 'completed', 'skipped'] },
    completedAt: Date,
    skippedAt: Date
  }]
}
```

---

## 10. API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/platform/home` | Extend snapshot with `onboarding` |
| `GET` | `/api/onboarding/me` | Full onboarding state for guards and `/onboarding` wizard |
| `PATCH` | `/api/onboarding/me` | Actions: `dismiss`, `set_goal`, `skip_step`, `complete_step`, `save_workspace`, `mark_coachmark` |
| `PATCH` | `/api/onboarding/organization` | Org-level step complete/skip |

### 10.1 Platform Home snapshot extension

```ts
interface PlatformHomeOnboarding {
  personaKey: string;
  origin: string;
  showWelcome: boolean;
  showSetupProgress: boolean;     // founders only
  progress: { completed: number; total: number };
  steps: OnboardingStep[];
  welcome?: {
    orgName: string;
    inviterName?: string;
    roleName?: string;
    welcomeNote?: string;
    entitledApps: string[];
    primaryAction?: EmptyStateAction;
  };
  trial?: {
    daysRemaining: number;
    contactsUsed: number;
    contactsLimit: number;
  };
}
```

---

## 11. Client Surfaces

| Surface | Change |
|---------|--------|
| `views/Onboarding.vue` | New — founder setup wizard |
| `views/platform/PlatformHome.vue` | WelcomePanel, GettingStartedCard, SetupProgressCard, TrialBanner |
| `views/AcceptInvitePage.vue` | Profile essentials + auto-login |
| `components/auth/RegistrationForm.vue` | Fix post-register redirect |
| `components/settings/InviteUserDrawer.vue` | Optional welcome note, suggested task |
| `router/index.js` | Onboarding guard |
| `utils/buildModuleListFromRegistry.ts` | Emit `FIRST_TIME` when API flags first visit |
| `locales/en/onboarding.json` | New namespace; all step copy via `labelKey` |

---

## 12. Analytics (PostHog)

**Implemented** — see [ONBOARDING_ACTIVATION_ANALYTICS.md](./ONBOARDING_ACTIVATION_ANALYTICS.md).

| Event | Properties |
|-------|------------|
| `onboarding_started` | `persona`, `origin`, `organization_id` |
| `onboarding_step_completed` | `step_key`, `persona`, `origin` |
| `onboarding_completed` | `persona`, `origin` |
| `invite_sent` | `source`, `send_email`, `has_welcome_note`, `has_suggested_task` |
| `invite_accepted` | `entitled_apps` |
| `first_contact_created` | `source`, `persona`, `origin` |
| `sample_data_accepted` | `persona`, `origin` |
| `coachmark_seen` | `coachmark_key` |
| `first_time_empty_state_seen` | `module_key`, `app_key` |

**Funnel:** `acquisition → first_login → step_1 → first_record_action → day_7_active`

| Metric | Target |
|--------|--------|
| Invite accept → first login | < 24h median |
| Invited: first login → first action | < 3 min |
| Founder: first login → first record/import | < 5 min |
| Checklist completion (7 days) | > 70% |
| Onboarding dismiss without action | < 20% |
| 7-day retention (invited vs baseline) | +15% |

---

## 13. i18n

- Namespace: `onboarding.*`
- Keys: lowerCamelCase, max 3 segments
- All user-visible strings via `t('onboarding.{key}')` — no hardcoded copy in components
- Step labels referenced by server `labelKey` (e.g. `onboarding.stepCompleteProfile`)

---

## 14. Explicitly Excluded (v1)

- Full-screen 10+ step wizard for invited users
- Generic video tours
- Org billing / payment during onboarding
- Duplicate per-app onboarding wizards (Platform Home checklist + `FIRST_TIME` empty states suffice)
- Chatbot "Ask me anything" assistant
- Demo-request confirmation page as product onboarding (lead capture only)

---

## 15. Phased Rollout

**Complete.** P0–P3 shipped. No P4 planned.

| Phase | Invited | Founder | Status |
|-------|---------|---------|--------|
| **P0** | Welcome panel + checklist + `User.onboarding` + persona resolver | Fix register redirect + `/onboarding` shell + steps 1–2 | ✅ |
| **P1** | Accept-invite profile + auto-login + inviter notifications | Steps 3–4 (first value action) + trial banner | ✅ |
| **P2** | `FIRST_TIME` empty states + coachmarks | Vertical templates + sample data opt-in | ✅ |
| **P3** | Admin invite enhancements + stalled-invite nudges | Inline invite step + trial email nudges | ✅ |

---

## 16. Maintenance Mode

Onboarding is a **platform capability** in maintenance mode — not an active product initiative.

### Rules

1. **No P4 roadmap.** Do not plan new onboarding phases unless data identifies a bottleneck.
2. **No new mechanics** (wizards, tours, assistants, persona tracks, billing onboarding, re-onboarding) without evidence from: PostHog funnels, user interviews, support-ticket trends, or activation/retention metrics.
3. **Extend the platform standard** — reuse `onboardingService`; no parallel onboarding frameworks.
4. **New apps/modules** must pass the merge checklist (below) before merge.
5. **Prefer maintenance work:** bug fixes, analytics coverage, funnel instrumentation, new-module alignment, translation updates, Platform Home consistency.
6. **Enhancement proposals** must document: funnel step, current conversion/drop-off, supporting evidence, expected impact, success metric.

### Allowed work

- Bug fixes
- Analytics and funnel instrumentation
- New-module/app alignment (empty states, visits, i18n, Platform Home)
- Translation updates
- Derived org-step completion when new setup signals exist

### Enhancement proposal template

Required before any non-maintenance onboarding change:

| Field | Description |
|-------|-------------|
| Funnel step | Which step in Founder or Member funnel (see analytics doc) |
| Current conversion / drop-off | Baseline from PostHog or qualitative evidence |
| Supporting evidence | Funnel export, interview notes, ticket IDs, retention chart |
| Expected impact | What should improve and by how much (estimate) |
| Success metric | Measurable outcome (e.g. step 3→4 conversion +10% in 30 days) |

### Platform standard for new apps

When adding apps (e.g. Inventory, Procurement, Customer Portal, Partner Portal), **extend this architecture** — do not create parallel onboarding frameworks.

| Requirement | Pattern |
|-------------|---------|
| State & logic | Reuse `server/services/onboardingService.js` |
| First visit UX | Add `FIRST_TIME` empty state in `buildModuleListFromRegistry.ts` + i18n keys in `onboarding.*` |
| Visit tracking | `record_module_visit` via `useOnboarding` (wired through `ModuleList.vue`) |
| Analytics | Events in `client/src/config/posthogOnboarding.ts` (`first_time_empty_state_seen`, etc.) |
| Checklist / wizard | Extend existing step keys and persona context — no new wizards per app |

### New module/app merge checklist (required)

Before merge of any new module or app surface. Prevents onboarding from becoming Sales-only.

| ☐ | Requirement | Where |
|---|-------------|-------|
| ☐ | **i18n complete** | User-visible copy in locale JSON (`onboarding.*`, module namespace); all supported locales updated |
| ☐ | **FIRST_TIME empty state** | `buildModuleListFromRegistry.ts` + `EmptyStateType.FIRST_TIME` + `onboarding.firstTime{Module}*` keys |
| ☐ | **Module visit tracking** | `ModuleList.vue` → `useOnboarding.recordModuleVisit` (automatic when list loads) |
| ☐ | **PostHog analytics coverage** | `posthogOnboarding.ts` — at minimum `first_time_empty_state_seen` fires for the module |
| ☐ | **Platform Home integration** | If applicable: entitled apps, quick access, app pulse, or setup progress in `platformHomeService` |
| ☐ | **Permissions validated** | List/empty state/actions respect `appPermissions`; no onboarding CTA bypasses auth |
| ☐ | **Empty-state classification reviewed** | Correct type per `empty-state.types.ts`: `FIRST_TIME` (first visit) · `NO_DATA` (configured, zero records / filtered empty) · `NO_ACCESS` · `NOT_CONFIGURED` · `DISABLED`. Errors are not empty states. |

N/A items must be noted in the PR (e.g. "Platform Home N/A — settings-only module").

Reference: [ONBOARDING_ACTIVATION_ANALYTICS.md](./ONBOARDING_ACTIVATION_ANALYTICS.md).

---

## 17. Security & Tenancy

- All onboarding state reads/writes scoped by `organizationId` and `req.user._id`.
- Org-level onboarding PATCH requires owner or `settings.manageUsers` (or equivalent admin permission).
- Welcome note and suggested tasks created by inviter validated in-tenant.
- Sample data opt-in creates tenant-isolated records only; purge respects deletion service.
- No bypass of permission checks during onboarding CTAs — actions gated by existing `appPermissions`.

---

## 18. Open Questions (closed unless data reopens)

1. **Auto-login after accept-invite** — issue JWT in accept response vs redirect-to-login? Prefer JWT for friction reduction; document security review.
2. **Sample data** — global templates vs vertical-specific seed scripts? Start with CSV download; seed scripts in P2.
3. **Multi-instance login** — founders on dedicated tenant instances: onboarding route on tenant subdomain only; align with existing session transfer hash flow.
4. **Re-onboarding** — role change mid-lifecycle: partial checklist refresh vs ignore? v1: ignore unless `onboarding.completedAt` is null.
