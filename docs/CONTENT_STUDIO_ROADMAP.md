# Content Studio — Article & Blog Builder Roadmap

**Source spec:** [ContentEngine.md](./ContentEngine.md) — Arivu Content Studio v1.0 (Draft)  
**Architecture reference:** [Architecture_Document.md](./Architecture_Document.md) §4–5 (app entitlements, permissions, tenant isolation)  
**Addon platform reference:** [LIVE_CHAT_ADDON_ROADMAP.md](./LIVE_CHAT_ADDON_ROADMAP.md) §5 (catalog, entitlement, configuration)  
**Last updated:** 2026-07-06

---

## 1. Executive summary

Content Studio delivers a **world-class block-based content authoring experience** shared by two **optional, tenant-installable addons**:

| Addon | `addonKey` | Parent app (required) | Primary surface |
|-------|------------|----------------------|-----------------|
| **Articles** | `articles` | **Helpdesk** (`HELPDESK`) | Helpdesk → Articles; Portal Knowledge Base |
| **Blog** | `blog` | **Marketing** (`MARKETING`) | Marketing → Blog; tenant public website |

Both addons share one **Content Canvas** (Tiptap block editor), one **structured JSON document model**, and one **rendering / publishing engine** built on the existing `contentPlatform` stack. They differ in metadata, blocks, workflows, and publishing targets.

**Licensing:** Each addon is **priced independently** with a **7-day trial**. Final plan tiers and price points are **TBD** — registry placeholders only until product pricing is finalized.

**Product goal:** Create once. Publish everywhere — portal help center, hosted blog, headless API, and tenant website embed — with brand-matched output and minimal training.

---

## 2. Separation doctrine (locked)

> **Content Studio owns authoring and publishing.** **Parent apps own navigation and business context.** **Addons own entitlement — not the base app install.**

| Layer | Owns |
|-------|------|
| **Content Platform (core)** | Block schema, Content Canvas, renderers, themes, media, version snapshots, public delivery APIs |
| **Articles addon** | Knowledge article CRUD, KB collections, portal publishing, case deflection surfacing |
| **Blog addon** | Blog post CRUD, categories/tags/authors, RSS, SEO studio, campaign bridge |
| **Helpdesk app** | Cases, SLAs, portal shell — **does not include Articles without addon** |
| **Marketing app** | Campaigns, audiences, segments — **does not include Blog without addon** |

### Hard rules for contributors

1. **No Articles UI or APIs** without `requireAddonEntitlement('articles')` **and** `requireHelpdeskApp`.
2. **No Blog UI or APIs** without `requireAddonEntitlement('blog')` **and** `requireMarketingApp`.
3. **Install gate:** Tenant cannot install `articles` unless Helpdesk app is `TRIAL` or `ACTIVE`. Same for `blog` + Marketing app.
4. **Do not store HTML** as source of truth — structured blocks JSON only; HTML at render time.
5. **GrapesJS stays** for email/PDF/layout templates. **Tiptap** is the Article/Blog editor — no GrapesJS for editorial content.
6. **Tenant isolation:** all content keyed by `organizationId`; public APIs respect published state and visibility.
7. **Reuse** `contentPlatform` (themes, assets, render pipeline, audit) — no parallel content stack.

---

## 3. Addon catalog & licensing

### 3.1 Platform catalog (master DB)

Extend `AddonDefinition` seed (`server/scripts/seedAddonDefinitions.js`):

```javascript
// Articles — requires Helpdesk
{
  addonKey: 'articles',
  name: 'Articles',
  description: 'Knowledge base article builder with block editor, portal publishing, and case deflection.',
  icon: 'book-open',
  category: 'COMMUNICATION',
  requiredApps: ['HELPDESK'],          // install-time gate (new field or validated in service)
  optionalApps: ['PORTAL', 'SALES'],
  marketplace: {
    category: 'Helpdesk',
    comingSoon: true,
    beta: false,
    shortDescription: 'Build and publish help articles to your customer portal and website.',
  },
}

// Blog — requires Marketing
{
  addonKey: 'blog',
  name: 'Blog',
  description: 'Marketing blog builder with SEO, categories, RSS, and tenant website publishing.',
  icon: 'newspaper',
  category: 'COMMUNICATION',
  requiredApps: ['MARKETING'],
  optionalApps: ['SALES'],
  marketplace: {
    category: 'Marketing',
    comingSoon: false,
    beta: false,
    shortDescription: 'Publish a branded blog on your website without WordPress.',
  },
}
```

Add keys to `server/constants/addonKeys.js`: `ARTICLES: 'articles'`, `BLOG: 'blog'`.

### 3.2 Pricing & trial (TBD)

Registry placeholders in `server/constants/addonPricingRegistry.js`:

```javascript
articles: {
  billingType: 'FLAT',           // TBD — may become PER_AUTHOR or tiered by article count
  defaultPlan: 'BASIC',
  trialDays: 7,
  plans: {
    BASIC:       { flatPriceCents: null, currency: 'USD' },  // price TBD
    PRO:         { flatPriceCents: null, currency: 'USD' },
    ENTERPRISE:  { flatPriceCents: null, currency: 'USD' },
  },
},
blog: {
  billingType: 'FLAT',           // TBD — may become tiered by monthly posts or traffic
  defaultPlan: 'BASIC',
  trialDays: 7,
  plans: {
    BASIC:       { flatPriceCents: null, currency: 'USD' },  // price TBD
    PRO:         { flatPriceCents: null, currency: 'USD' },
    ENTERPRISE:  { flatPriceCents: null, currency: 'USD' },
  },
},
```

**Trial behavior:** On install, `OrganizationSubscription.addons[]` entry gets `status: 'TRIAL'`, `trialEndsAt: now + 7 days`. After expiry without payment → `SUSPENDED` (read-only existing published content; no new publish). Mirrors app trial patterns.

**Pricing decision deferred** to product/billing — engineering ships entitlement + trial infrastructure first.

### 3.3 Tenant configuration (per addon)

**Model:** `TenantAddonConfiguration` (existing pattern)

```javascript
// articles
{
  organizationId,
  addonKey: 'articles',
  enabled: true,
  settings: {
    portalPublishing: true,
    publicWebsitePublishing: false,
    defaultCollectionId: null,
    caseDeflectionEnabled: true,
    staleContentAlertDays: 90,
  },
}

// blog
{
  organizationId,
  addonKey: 'blog',
  enabled: true,
  settings: {
    hostedSubdomain: null,       // e.g. acme-help → acme-help.help.arivusystems.com
    customDomain: null,
    urlPrefix: '/blog',
    rssEnabled: true,
    commentsEnabled: false,
    defaultAuthorId: null,
  },
}
```

**Shared brand settings** live under **Settings → Content Publishing** (platform-level, not per-addon) — logo, colors, fonts, content width — backed by `ContentTheme`.

### 3.4 Settings → Addons (hub UI)

| Route | View |
|-------|------|
| `/settings?tab=addons` | Marketplace cards for Articles + Blog (gated by parent app) |
| `/settings?tab=addons&addonView=articles` | Articles addon hub — publishing, collections, deflection |
| `/settings?tab=addons&addonView=blog` | Blog addon hub — domain, RSS, authors, SEO defaults |
| `/settings?tab=content-publishing` | Shared brand profile + integration wizard (embed, API keys) |

**Install UX copy:**
- Articles card visible only when Helpdesk is installed. CTA: *"Requires Helpdesk — Start 7-day trial"*
- Blog card visible only when Marketing is installed. CTA: *"Requires Marketing — Start 7-day trial"*

---

## 4. Architecture overview

```text
                    Content Canvas (Tiptap)
                              │
                    Structured JSON document
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
   Articles addon         Blog addon         contentPlatform
   (HELPDESK gate)      (MARKETING gate)     (themes, assets, render)
         │                    │                    │
         ▼                    ▼                    ▼
   Portal KB              Blog archive         Hosted pages
   Case deflection        RSS / SEO            Headless API
                          Campaign bridge      Embed widget
```

### 4.1 Shared content model (new)

```
ContentDocument
├── organizationId
├── contentType: 'knowledge_article' | 'blog_post'
├── addonKey: 'articles' | 'blog'
├── appKey: HELPDESK | MARKETING
├── metadata (type-specific)
├── seo
├── publishingTargets[]
├── status: draft | review | scheduled | published | archived
├── currentVersionId → blocks JSON (ProseMirror/Tiptap doc)
├── publishedVersionId
└── audit fields
```

**Migration path:** Existing `Document` records with `documentType: 'knowledge_article'` import to `ContentDocument` via one-time utility (Phase CS-A2).

### 4.2 Technology choices

| Concern | Choice | Notes |
|---------|--------|-------|
| Editor | **Tiptap + ProseMirror** | Per ContentEngine.md §76 — Notion-like UX |
| Layout templates | **GrapesJS** (existing) | Email, PDF, landing pages only |
| Storage | MongoDB tenant DB | `content_documents`, `content_versions` |
| Rendering | Extend `contentRenderService` | Channel renderers: `portal_kb`, `blog_web`, `headless_json` |
| Theming | `ContentTheme` + Brand Profile | Presentation separate from content |
| Search | Extend document/search index | Headings, body, tags, categories |
| Public delivery | CDN-cached HTML + REST API | `renderPreviewCache` pattern → production cache |

### 4.3 API namespaces

| Namespace | Middleware | Purpose |
|-----------|------------|---------|
| `/api/content/*` | Auth + tenant | Shared CRUD, versions, media, themes |
| `/api/helpdesk/articles/*` | `requireHelpdeskApp` + `requireAddonEntitlement('articles')` | Article list, publish to portal |
| `/api/marketing/blog/*` | `requireMarketingApp` + `requireAddonEntitlement('blog')` | Blog list, categories, RSS config |
| `/api/public/v1/content/*` | Public + org resolver | Headless delivery (published only) |
| `/embed/content/*` | Embed token / org key | Widget + iframe delivery |

---

## 5. Progress tracker

| Phase | Scope | Status | Target |
|-------|-------|--------|--------|
| **CS-0** — Foundation & addon registration | Schema, addon catalog, entitlement, ADR | 🟡 In progress | 2–3 weeks |
| **CS-1** — Content Canvas MVP | Tiptap editor, blocks v1, autosave, preview, SEO panel | 🟡 In progress | 6–8 weeks |
| **CS-A** — Articles addon | Helpdesk module, KB blocks, portal publish, deflection | ❌ Not started | 4–6 weeks |
| **CS-B** — Blog addon | Marketing module, blog metadata, RSS, SEO studio v1 | ✅ Parity pass: default collection/visibility, headless recent/popular/collections/sitemap, embed pack + CORS origins, sticky/tags/readingTime, SEO score, analytics route | 4–6 weeks |
| **CS-3** — Tenant website publishing | Brand profile, hosted subdomain, custom domain, embed, headless API | ❌ Not started | 6–8 weeks |
| **CS-4** — Distribution & growth | Analytics, campaign bridge, comments, scheduling, OG images | ❌ Not started | 4–6 weeks |
| **CS-5** — Collaboration & AI | Review workflow, AI studio, import, accessibility audit | ❌ Not started | 6–8 weeks |
| **CS-6** — Enterprise & headless | Multi-site, GraphQL, edge CDN, custom blocks SDK | ❌ Future | TBD |

**Recommended build order:** CS-0 → CS-1 → **CS-A** (Articles first — portal consumption exists) → CS-B → CS-3.

**First shippable milestone:** Tenant with Helpdesk + Articles trial publishes a help article to Portal in < 10 minutes.

---

## 6. Phase detail

### CS-0 — Foundation & addon registration (2–3 weeks)

| Deliverable | Details |
|-------------|---------|
| ADR | Content Canvas architecture; Tiptap vs GrapesJS boundary |
| `addonKeys` + seed | `articles`, `blog` in catalog with `trialDays: 7` |
| Install validation | Reject install if parent app not entitled |
| `requireAddonEntitlement` routes | Stub routers for articles + blog |
| Block schema v1 | JSON contract + validation service |
| `ContentDocument` + `ContentVersion` models | Tenant-scoped, version-first |
| Renderer contract | `renderBlocksToHtml(blocks, theme, channel)` |
| Permissions | `articles.*`, `blog.*` role keys |
| i18n namespaces | `articles.json`, `blog.json`, `contentStudio.json` |
| PostHog events | `articles_addon_installed`, `blog_addon_installed`, `content_published` |

**Exit criteria:** Addon install with 7-day trial works; block JSON round-trips through renderer with theme tokens.

---

### CS-1 — Content Canvas MVP (6–8 weeks)

Shared by both addons. No public website publishing yet.

#### Layout (per ContentEngine.md §17)

```
┌────────────────────────────────────────────────────────────┐
│ Header: Back · Status · Preview · Publish · AI (stub)      │
├───────────────┬────────────────────────────┬───────────────┤
│ Outline / TOC │ Content Canvas             │ Properties    │
├───────────────┴────────────────────────────┴───────────────┤
│ Status bar: save state · word count · reading time         │
└────────────────────────────────────────────────────────────┘
```

#### Features

| Feature | Priority |
|---------|----------|
| Slash commands `/` | P0 |
| Floating toolbar (bold, italic, link) | P0 |
| Autosave (< 500ms) + undo/redo | P0 |
| Title, summary, cover image | P0 |
| SEO panel (title, description, slug, OG preview) | P0 |
| Device preview (desktop / tablet / mobile) | P0 |
| Version snapshots on publish | P0 |
| Media picker (reuse content asset library) | P0 |
| Starter templates | P1 |
| Keyboard shortcuts (doc §28) | P1 |

#### Blocks v1 (shared)

Paragraph · Heading (H1–H4) · Image · List · Checklist · Quote · Code · Divider · Callout (tip/warning/note) · Embed · Table

**Exit criteria:** Author creates content, previews, saves draft in < 5 minutes without training.

---

### CS-A — Articles addon (4–6 weeks)

**Entitlement:** `articles` addon + Helpdesk app.

| Feature | Details |
|---------|---------|
| Helpdesk nav module | `/helpdesk/articles` — list, create, edit |
| Addon hub settings | Portal publishing toggle, collections, deflection |
| KB-specific blocks | Steps, FAQ, Related Articles, Troubleshooting |
| Collections | Help Center structure (nested categories) |
| Portal publishing | Render blocks → portal KB (extend `PortalKnowledgeArticle`) |
| Visibility | Portal-only, internal, public website (when CS-3 live) |
| Search indexing | Headings + body for portal search |
| Case deflection | Suggest articles in case sidebar |
| Workflow | Draft → Published (approval in CS-5) |
| HTML migration | Import existing `knowledge_article` rich HTML → blocks |
| Permissions | `articles.create`, `articles.edit`, `articles.publish`, `articles.delete` |

**Exit criteria:** Support agent on Articles trial publishes article; customer finds it in portal; case agent sees suggestions.

---

### CS-B — Blog addon (4–6 weeks)

**Entitlement:** `blog` addon + Marketing app.

| Feature | Details |
|---------|---------|
| Marketing nav module | `/marketing/blog` — list, create, edit |
| Addon hub settings | URL prefix, RSS, authors, comments toggle |
| Blog metadata | Category, tags, author, reading time, featured/sticky | ✅ sticky/tags/readingTimeMinutes on ContentDocument + public shapers + inspector |
| Blog-specific blocks | Hero, CTA, Testimonial, Stats, Newsletter signup | 🟡 Hero + Newsletter present; Testimonial/Stats nodes not in editor yet (skipped) |
| Categories + tags | Nested categories, tag pages | 🟡 Categories yes; public tag pages still later |
| Author profiles | Avatar, bio, social links, recent posts | ⏳ Later |
| Archive rendering | Index, category, tag, author pages | ⏳ Customer-site; headless list/collections/recent/popular/sitemap shipped |
| RSS feed | Auto-generated per tenant | ✅ |
| SEO Studio v1 | Score, meta length, heading structure, broken links | 🟡 Client SEO score (title/desc/slug/H1) shipped; heading structure / broken links later |
| Related posts | Tag/category similarity |
| Permissions | `blog.create`, `blog.edit`, `blog.publish`, `blog.delete` |

**Exit criteria:** Marketing user on Blog trial publishes post with SEO score; RSS feed validates.

---

### CS-3 — Tenant website publishing (6–8 weeks)

**Headless implementation roadmap:** [HEADLESS_CONTENT_ROADMAP.md](./HEADLESS_CONTENT_ROADMAP.md) (HC-1–HC-9)

**Requires:** at least one of Articles or Blog addon installed.

#### 3A — Publishing configuration

**Settings → Content Publishing** (platform admin):

| Setting | Description |
|---------|-------------|
| Brand Profile | Logo, primary/secondary colors, fonts, button style, content width, border radius |
| Publishing target | Arivu Hosted · Custom Domain · Headless API only |
| URL structure | `/blog/{slug}`, `/help/{slug}` |
| Navigation | Header links, footer links |
| Integration tab | Embed snippet, API keys, webhooks |

#### 3B — Delivery channels

| Channel | Implementation |
|---------|----------------|
| **Hosted pages** | `https://{tenant}.help.arivusystems.com/...` |
| **Custom domain** | CNAME + SSL verification |
| **Headless API** | `GET /api/public/v1/content/{slug}` |
| **Embed widget** | `<script src=".../embed/content.js" data-collection="blog">` |
| **iframe** | Simple embed for WordPress / Squarespace |
| **RSS + sitemap.xml** | Auto-generated (Blog addon) |
| **Webhook** | `content.published` → tenant CI/CD |

#### 3C — Brand matching

- Theme tokens from Brand Profile applied at render time
- Live brand preview before publish
- Optional custom CSS (advanced tier — TBD)

**Exit criteria:** Tenant configures brand, publishes content, views on hosted subdomain or via headless API.

---

### CS-4 — Distribution & growth (4–6 weeks)

| Feature | Addon | Notes |
|---------|-------|-------|
| Reading experience (TOC, progress, share, dark mode, print) | Both | Public rendered pages |
| Native comments + moderation | Blog | Optional per tenant |
| Content analytics (views, read time, scroll depth) | Both | PostHog + aggregated store |
| Campaign bridge ("Send as email") | Blog | → Marketing campaign draft |
| Auto OG image generation | Both | Title + brand template |
| Scheduled publishing | Both | Timezone-aware |
| Multi-language v1 | Both | Linked translations, locale slugs |
| KB deflection analytics | Articles | "This article deflected N cases" |

---

### CS-5 — Collaboration & AI (6–8 weeks)

| Feature | Notes |
|---------|-------|
| Review workflow | Draft → Review → Approved → Published |
| Inline comments | Block-level |
| AI Studio (doc §36) | Rewrite, SEO improve, FAQ generate, alt text |
| AI quality gate | Pre-publish checklist |
| Content freshness alerts | Stale article warnings |
| Accessibility audit | WCAG scoring in-editor |
| Import | WordPress XML, Medium, Google Docs, HTML |

---

### CS-6 — Enterprise & headless (future)

- GraphQL content API
- Multi-site per tenant (region brands)
- Edge CDN rendering
- Custom block SDK
- Synced component library (global CTAs)
- A/B headline testing (Blog + Marketing)
- Static site export

---

## 7. Module placement & routing

| Surface | Route | Gates |
|---------|-------|-------|
| Articles list/editor | `/helpdesk/articles` | Helpdesk app + `articles` addon |
| Help Center settings | `/settings?tab=addons&addonView=articles` | `articles` addon + admin |
| Blog list/editor | `/marketing/blog` | Marketing app + `blog` addon |
| Blog settings | `/settings?tab=addons&addonView=blog` | `blog` addon + admin |
| Brand + Publishing | `/settings?tab=content-publishing` | `settings.edit` |
| Public API docs | `/settings?tab=content-publishing&view=api` | Admin |
| Portal article (read) | `/portal/knowledge/:slug` | Portal + published article |
| Public blog (read) | Hosted / custom domain / API | Published post |

**Marketplace visibility:**

| Tenant has | Sees in Addons marketplace |
|------------|---------------------------|
| Helpdesk only | Articles (installable, 7-day trial) |
| Marketing only | Blog (installable, 7-day trial) |
| Both apps | Both addons |
| Neither | Neither (cards hidden or show "Requires Helpdesk/Marketing") |

---

## 8. Reuse map (existing codebase)

| Existing | Role in Content Studio |
|----------|------------------------|
| `contentRenderService.js` | Extend with block + channel renderers |
| `ContentTheme` | Brand Profile for public pages |
| `ContentTemplate` (GrapesJS) | Unchanged — email/PDF/landing only |
| Marketing asset library (`MarketingAsset`) | Shared media picker |
| `Document` + `knowledge_article` | Migration source for Articles addon |
| `PortalKnowledgeArticle.vue` | Consume rendered block HTML |
| `renderPreviewCache.js` | Pattern for public page CDN cache |
| `requireAddonEntitlement` | Articles + Blog route gating |
| `addonPricingRegistry.js` | Trial + plan placeholders |
| `posthogMarketing.ts` | Extend for blog/content events |

---

## 9. World-class gaps (additions to ContentEngine.md)

These are required for tenant website publishing and are not fully specified in the source doc:

| Gap | Phase |
|-----|-------|
| Website Integration Wizard (embed, API, webhooks) | CS-3 |
| Hosted subdomain + custom domain + SSL | CS-3 |
| Parent app install gate for addons | CS-0 |
| 7-day trial + suspend behavior | CS-0 |
| WordPress / HTML import | CS-A / CS-5 |
| CRM loop analytics (deflection, campaign attribution) | CS-4 |
| Auto OG image generation | CS-4 |
| Accessibility checker (WCAG) | CS-5 |
| Content freshness alerts | CS-5 |
| Campaign bridge (blog → email) | CS-4 |

---

## 10. Success metrics

| Metric | Target |
|--------|--------|
| Addon install → first publish (Articles) | < 10 minutes |
| Addon install → first publish (Blog) | < 10 minutes |
| Editor open time | < 2 seconds |
| Typing latency | < 16 ms |
| Autosave | < 500 ms |
| Tenant public site live (wizard) | < 30 minutes |
| Trial → paid conversion | Track per addon (pricing TBD) |
| KB deflection rate | Per article (Articles addon) |
| SEO score at publish (Blog) | > 75 average |

---

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Building full Content Studio at once | Strict phasing; CS-1 MVP before addon features |
| Two editors (GrapesJS + Tiptap) confusion | Product naming: "Template Builder" vs "Content Canvas" |
| Addon without parent app | Hard install gate in `addonBootstrapService` |
| Tenant websites vary wildly | Hosted subdomain first; headless API second; embed third |
| Migrating existing KB HTML | Import tool in CS-A |
| Pricing unknown | Ship `trialDays: 7` + `flatPriceCents: null`; billing UI shows "Contact sales" or TBD until finalized |
| Scope creep (AI, co-edit, comments) | CS-5 / CS-4 only after publish loop works |

---

## 12. Immediate next steps (before CS-0 kickoff)

1. **Product sign-off** on addon model (Articles + Blog as priced addons, 7-day trial, parent app gates).
2. **ADR:** `docs/adr/CONTENT_STUDIO_ARCHITECTURE.md` — Tiptap canvas, shared document model, addon boundaries.
3. **Billing placeholder:** Add `articles` + `blog` to `addonPricingRegistry.js` with `trialDays: 7`, null prices.
4. **Design:** Content Canvas wireframes + Addons marketplace cards + Publishing Settings wizard.
5. **Spike:** Tiptap prototype — 5 blocks, JSON export, theme token injection.
6. **Update ContentEngine.md:** Cross-link this roadmap; add §Addon Licensing, §Website Integration, §Parent App Requirements.

---

## 13. Related documents

| Document | Purpose |
|----------|---------|
| [ContentEngine.md](./ContentEngine.md) | Full product vision and feature spec |
| [LIVE_CHAT_ADDON_ROADMAP.md](./LIVE_CHAT_ADDON_ROADMAP.md) | Addon platform patterns (reference) |
| [MARKETING_APPLICATION_ROADMAP.md](./MARKETING_APPLICATION_ROADMAP.md) | Marketing app modules and content platform reuse |
| [Architecture_Document.md](./Architecture_Document.md) | Platform core, entitlements, tenant isolation |
