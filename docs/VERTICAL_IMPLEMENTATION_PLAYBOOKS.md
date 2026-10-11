# Arivu Vertical Implementation Playbooks

**Companion to:** [VERTICAL_IMPLEMENTATION_GUIDE.md](./VERTICAL_IMPLEMENTATION_GUIDE.md)  
**Audience:** Implementation team — hands-on, step-by-step  
**Goal:** World-class tenant setup per vertical using **only shipped Arivu capabilities**  
**Last updated:** 2026-09-01

---

## How to use this document

Each playbook is a **repeatable lab** your team can run on a fresh trial tenant.

| Symbol | Meaning |
|--------|---------|
| **Settings →** | Navigate in app: `/settings` (use tab query params where noted) |
| **Work →** | Day-to-day module surface (People, Deals, etc.) |
| **Platform →** | Cross-app: Inbox, Platform Home, Documents, Analytics |
| ⏱ | Typical time for that step |
| ✅ | Verification — stop if this fails |

**Recommended lab setup**

1. Register a new org at `/register` and pick the **exact vertical label** from the playbook.
2. Complete founder onboarding (`/onboarding`) with goal matching the vertical.
3. Use a dedicated test email domain (e.g. `+retail@yourcompany.com`).
4. Keep one “golden tenant” per vertical as reference for sales demos.

---

## Shared foundation (run once per tenant, all verticals)

Complete these before vertical-specific steps.

### Step F1 — Workspace basics ⏱ 5 min

1. **Settings → Organization** — Set timezone, currency, date format, fiscal year start.
2. Upload logo (optional) — appears on quotes/invoices if commercial docs enabled.
3. **Settings → Business Hours** — Define working days/hours + holiday calendar (needed for SLAs, scheduling, helpdesk).

✅ Org settings persist; timezone reflects in task due dates.

### Step F2 — Users & roles ⏱ 10 min

1. **Settings → Users & Roles → Roles** — Clone `Owner` / `Admin` / `User` as needed.
2. Map **app permissions** per role (`SALES`, `HELPDESK`, `AUDIT`, etc.) — module CRUD + scope (`all` / `team` / `own`).
3. **Settings → Users** — Invite at least one teammate (validates Platform Home checklist).
4. Optional: **Settings → Profiles** — Field-level restrictions (e.g. hide deal amount for agents).

✅ Test user sees only entitled apps in sidebar.

### Step F3 — Email & Inbox ⏱ 15 min

1. **Settings → Email / Mailboxes** — Connect Gmail or configure outbound (AMDS credits if applicable).
2. **Platform → Inbox** — Confirm send/receive works.
3. For support verticals: configure inbound routing to Cases (Helpdesk).

✅ Send test email from a Person record; appears in Inbox thread.

### Step F4 — Import readiness ⏱ 10 min

1. **Work → People → Import** — Download sample CSV template.
2. Save a vertical-specific import mapping template (**Settings → Import** if saved mappings exist).
3. Run a 3-row test import; verify assignment and source fields.

✅ Import history shows success; records visible in list.

### Step F5 — Analytics baseline ⏱ 10 min

1. **Platform → Analytics** — Create folder `{Vertical} - Implementation`.
2. Add widgets: People count, Deals by stage, Tasks overdue (as applicable).
3. Confirm PostHog receives onboarding events (see `docs/ONBOARDING_ACTIVATION_ANALYTICS.md`).

✅ Dashboard loads for admin role.

### Step F6 — World-class baseline checklist

- [ ] All user-visible strings use i18n (no hardcoded labels in custom field names — use clear English labels)
- [ ] Empty states show `FIRST_TIME` guidance on primary modules
- [ ] Assignment rules exist (even simple round-robin)
- [ ] At least one automation or process rule for the vertical’s main lifecycle
- [ ] Documents folder structure created (`Platform → Documents`)
- [ ] Notification preferences reviewed for owner + agents

---

# Vertical playbooks

---

## 1. Retail (Fashion, Electronics, Footwear, etc.)

**Template key:** `retail` · **Primary app:** SALES · **Emphasis:** people, deals, **items**

### World-class outcome

Omni-channel retailer runs: **catalog → deal with line items → quote → invoice → payment**, with inventory visibility and support cases for returns.

### Apps & addons to enable

| Capability | Enable when |
|------------|-------------|
| SALES | Always |
| INVENTORY | Stock tracking, multi-location |
| HELPDESK | Returns, warranty, post-purchase support |
| MARKETING | Email campaigns to customer segments |
| `live_chat` addon | Website sales support |
| Payment gateway | Online invoice collection |

### Step-by-step

#### 1.1 Catalog foundation ⏱ 45 min

1. **Settings → Catalog** (Categories) — Create tree: e.g. `Apparel → Men → Shirts`, `Electronics → Audio`.
2. **Settings → Catalog** (Attribute templates) — Add Size, Color, Brand (tenant metadata — not code).
3. **Work → Items** — Create 5–10 parent items with:
   - `lifecycle_state`: Active
   - Default variant: SKU, barcode, selling price
   - Media gallery (product images)
4. **Settings → Catalog → Price books** — Optional: Retail vs Wholesale price book with effective dates.

✅ Item picker shows active variants; images render on item detail.

#### 1.2 People & organizations ⏱ 20 min

1. **Settings → Core Modules → People** — Custom fields: `preferredStore`, `loyaltyTier`, `customerSince`.
2. **Settings → Core Modules → Organizations** — Types: Customer, Supplier, Retail Partner.
3. **Settings → Assignment Rules** — Round-robin new People with `source = Web` to sales team.

✅ Quick-create person shows custom fields.

#### 1.3 Deal pipeline ⏱ 25 min

1. **Settings → Core Modules → Deals** — Stages: `Inquiry → Qualified → Proposal → Negotiation → Won → Lost`.
2. Custom fields: `channel` (Store / Online / Marketplace), `storeLocation`.
3. Enable **Deal lines** — link variants from catalog (validates CPQ path).

✅ Deal amount in `AUTO` mode updates from lines.

#### 1.4 Commercial flow ⏱ 40 min

1. **Work → Deals** — Create deal with 2+ catalog line items.
2. **Convert to Quote** — Review sections, taxes (**Settings → Inventory → Taxes** if applicable).
3. Send quote (email PDF) → Accept → **Sales Order** → **Invoice**.
4. **Settings → Payment Gateways** — Stripe/Razorpay; generate **Payment Link** on invoice.

✅ End-to-end: Deal → Quote → Invoice → Payment recorded.

#### 1.5 Inventory (if enabled) ⏱ 30 min

1. **Settings → Inventory** — Locations (warehouse, stores).
2. Receive stock via inventory transactions; verify `iteminventory` balances.
3. On Sales Order — create fulfillment / reservation per `INVENTORY` app flows.

✅ Stock decrements on fulfillment (or reservation holds).

#### 1.6 Support & retention ⏱ 25 min

1. Enable **HELPDESK** — Case lifecycle: `New → Working → Waiting on Customer → Resolved`.
2. **Settings → SLA Policies** — e.g. 24h first response for `priority = High`.
3. Link Case requester to People; use **Response Templates** for return instructions.

✅ Case created from Inbox email links to customer.

#### 1.7 Marketing & acquisition ⏱ 20 min

1. **Settings → Webforms** — “Product inquiry” form → creates People with source `Webform`.
2. **MARKETING** — Audience: People with `loyaltyTier = Gold`; campaign with unsubscribe compliance.
3. Optional: **`live_chat` addon** — Widget brand color in **Settings → Addons → Live Chat**.

✅ Webform submission creates lead assigned by rule.

#### 1.8 Automation ⏱ 15 min

1. **Settings → Automation** or **Processes** — When Deal stage → `Won`, create Task “Schedule delivery follow-up”.
2. When Case status → `Resolved`, send satisfaction email via communication template.

✅ Rule execution logged in automation history.

### UAT script (team trial)

1. Register tenant with vertical **Retail (Fashion, Electronics, Footwear, etc.)**
2. Accept sample data OR import 10 contacts CSV
3. Create item with 2 variants → deal with both lines → quote → invoice → payment link
4. Submit webform → verify lead assignment
5. Open case for return → resolve within SLA

### Success metrics (30 days)

- ≥80% of won deals have catalog line items
- Quote-to-invoice conversion < 48h median
- Case first-response within SLA

---

## 2. Real Estate

**Template key:** `real_estate` · **Primary app:** SALES · **Emphasis:** people, deals, **organizations**

### World-class outcome

Brokerage tracks **buyers/sellers (People)**, **developers & agencies (Organizations)**, property deals with milestone pipeline, site-visit tasks, and document vault for agreements.

### Apps to enable

| Capability | Enable when |
|------------|-------------|
| SALES | Always |
| MARKETING | Property launch campaigns |
| DOCUMENTS | Agreements, brochures, RERA docs |
| PROJECTS | Large builder PM (if entitled) |

### Step-by-step

#### 2.1 Organizations (accounts) ⏱ 30 min

1. **Settings → Core Modules → Organizations** — Types: `Developer`, `Broker Agency`, `Channel Partner`, `Customer`.
2. Custom fields: `reraId`, `primaryMarkets`, `commissionStructure`.
3. Link account manager via `assignedTo`.

✅ Organization list filtered by type works.

#### 2.2 People (buyers & agents) ⏱ 25 min

1. Custom fields: `budgetMin`, `budgetMax`, `preferredLocations`, `propertyType` (picklist: 1BHK, 2BHK, Villa, Commercial).
2. SALES participation: Lead vs Contact lifecycle.
3. **Relationship** (if configured): Person ↔ Organization (agent belongs to agency).

✅ Person detail shows related organizations.

#### 2.3 Deal pipeline ⏱ 30 min

1. Stages: `Inquiry → Site Visit Scheduled → Negotiation → Token Paid → Agreement → Registered → Won / Lost`.
2. Custom fields: `projectName`, `unitNumber`, `carpetArea`, `agreementValue`, `expectedRegistrationDate`.
3. Link deal to **primary Organization** (developer) and **primary Person** (buyer) per platform rules.
4. Amount mode: **MANUAL** (milestone-based) unless using standard CPQ.

✅ Deal shows multi-party links (buyer + developer).

#### 2.4 Tasks & events ⏱ 20 min

1. **Work → Tasks** — Task types: Site visit, Document collection, Loan follow-up.
2. **Work → Events** — Open house / site visit events with linked People.
3. **Settings → Scheduling** — Public booking link for site visits (if used).

✅ Task created from deal record with `relatedTo` link.

#### 2.5 Documents ⏱ 20 min

1. **Platform → Documents** — Folders: `Projects / {ProjectName} / Brochures`, `Deals / Agreements`.
2. Upload sample agreement; use OCR search to verify findability.
3. Link documents to Deal via record attachments.

✅ Document searchable by project name (semantic/OCR).

#### 2.6 Commercial (optional) ⏱ 25 min

1. Milestone invoices: Token, Agreement, Possession — manual amount invoices from Won deal.
2. **Settings → Taxes** — GST/VAT as per region.
3. Payment links for token collection.

✅ Invoice PDF reflects org branding.

#### 2.7 Marketing ⏱ 15 min

1. Webform: “Download brochure” → captures People + project interest.
2. Marketing audience: People in `preferredLocations` containing target city.
3. Campaign: new launch announcement with unsubscribe.

✅ Audience preview shows geographic filter.

#### 2.8 Automation ⏱ 15 min

1. Stage → `Site Visit Scheduled` → create Event + Task for assigned agent.
2. Stage → `Lost` → require `lostReason` (configure picklist: Price, Location, Competitor).

✅ Lost deals always have reason populated (validation via required field).

### UAT script

1. Create Developer org + 2 buyer leads
2. Create deal linking both; move through site visit stage
3. Schedule event; complete task
4. Upload agreement to Documents; attach to deal
5. Win deal → create token invoice

### Success metrics

- 100% of active deals linked to Organization + Person
- Site visit → negotiation conversion tracked by stage
- Median time inquiry → site visit < 72h

---

## 3. Service-Based (Gyms, Salons)

**Template key:** `services` · **Primary app:** SALES · **Emphasis:** people, **tasks**

### World-class outcome

Membership/service business manages **members**, **appointment tasks**, renewals, and optional billing — with scheduling and reminders.

### Apps to enable

| Capability | Enable when |
|------------|-------------|
| SALES | CRM + tasks |
| HELPDESK | Member complaints |
| Scheduling / Appointments | Self-serve booking |

### Step-by-step

#### 3.1 People (members) ⏱ 25 min

1. Custom fields: `membershipPlan`, `membershipStart`, `membershipExpiry`, `preferredTrainer`, `visitCount`.
2. Tags: `Active`, `Expired`, `Trial`.
3. Assignment: front-desk vs trainer teams via Groups.

✅ Filter People by expiring membership (saved filter).

#### 3.2 Task model ⏱ 30 min

1. **Settings → Core Modules → Tasks** — Statuses: `Scheduled → In Progress → Completed → Cancelled`.
2. Priorities: Normal, VIP.
3. Custom fields: `serviceType` (Haircut, PT Session, Class), `duration`, `station`.
4. Default view: calendar or list by due date.

✅ Task board/calendar shows today’s appointments.

#### 3.3 Scheduling ⏱ 25 min

1. **Settings → Scheduling** — Service types, staff availability, buffers.
2. Public booking page — embed link on website.
3. Booking creates Task + links to Person automatically.

✅ Public booking creates task assigned to staff.

#### 3.4 Renewals & automation ⏱ 20 min

1. Process rule: 7 days before `membershipExpiry` → Task “Renewal call” for assigned owner.
2. Notification: task overdue → in-app + email to assignee.
3. Optional: Won deal for membership upgrade (simple deal pipeline: `Inquiry → Upgraded`).

✅ Renewal task auto-created on test member.

#### 3.5 Helpdesk (optional) ⏱ 15 min

1. Cases for billing disputes, service complaints.
2. SLA: 8 business hours first response.

✅ Case from member email ties to Person.

#### 3.6 Commercial (optional) ⏱ 20 min

1. Items: membership plans as catalog items (monthly/annual).
2. Invoice on renewal; payment link sent via email.

✅ Invoice line describes plan variant.

### UAT script

1. Add 5 members with varied expiry dates
2. Book appointment via public scheduling
3. Complete task; verify activity on Person
4. Trigger renewal automation
5. Log complaint case; resolve

### Success metrics

- Appointment no-show rate tracked via task status
- Renewal tasks completed before expiry ≥ 70%
- Member record has full activity timeline

---

## 4. Education Institutes

**Template key:** `education` · **Primary app:** SALES · **Emphasis:** people, tasks, **events**

### World-class outcome

Admissions office runs **inquiry → counseling → application → enrollment** with events (open days), counselor tasks, and campaign-driven lead gen.

### Apps to enable

| Capability | Enable when |
|------------|-------------|
| SALES | Pipeline / people |
| MARKETING | Admission campaigns |
| Webforms | Inquiry capture |
| EVENTS | Open days, webinars |

### Step-by-step

#### 4.1 People (students & parents) ⏱ 30 min

1. Custom fields: `gradeApplying`, `academicYear`, `parentName`, `parentPhone`, `leadStage` (picklist: Inquiry, Counseling, Applied, Admitted, Enrolled, Lost).
2. Source tracking: Walk-in, Website, Referral, Campaign.
3. Duplicate detection on email + phone.

✅ Counselor view: filter by `leadStage` and `gradeApplying`.

#### 4.2 Admission pipeline ⏱ 25 min

**Option A — Deal-based:** Pipeline stages mirror admission funnel.  
**Option B — Task-based:** Stages on Person picklist + task per stage (lighter weight).

Recommended hybrid:

1. Deals: `Inquiry → Counseling → Application Submitted → Interview → Offer → Enrolled`.
2. Deal custom fields: `course`, `campus`, `scholarshipEligible`.

✅ Move sample lead through 3 stages.

#### 4.3 Events ⏱ 30 min

1. **Work → Events** — Types: Open Day, Webinar, Campus Tour.
2. Link registered People to event; track attendance status.
3. Post-event Task: “Follow up attendees within 48h”.

✅ Event record shows linked registrants.

#### 4.4 Tasks for counselors ⏱ 20 min

1. Task templates: Document collection, Fee reminder, Interview schedule.
2. Assignment rules: route by `campus` or counselor group.

✅ New inquiry auto-assigns to counselor.

#### 4.5 Webforms & marketing ⏱ 25 min

1. Webform fields match People custom fields.
2. Marketing segment: `leadStage = Inquiry` AND `gradeApplying = 10`.
3. Drip campaign: Open Day invitation (respect marketing subscription preferences).

✅ Form submit → Person + optional Deal created.

#### 4.6 Documents ⏱ 15 min

1. Folder: `Admissions / Applications / {Year}`.
2. Collect scanned forms attached to Person/Deal.

✅ Document upload from Person record.

#### 4.7 Analytics ⏱ 15 min

1. Dashboard: funnel by stage, conversion by source, event attendance rate.
2. Targets (if enabled): monthly enrollment goal per counselor.

✅ Widget shows inquiry → enrolled conversion.

### UAT script

1. Import 20 inquiry CSV rows
2. Run open day event; mark attendance
3. Move 5 leads to Application Submitted
4. Send campaign to inquiry segment
5. Enroll 2 students; verify won deals or stage = Enrolled

### Success metrics

- Inquiry → counseling contact within 24h
- Event attendance → application rate
- Enrollment target vs actual (monthly)

---

## 5. Healthcare Clinics

**Template key:** `healthcare` · **Primary app:** SALES · **Emphasis:** people, **tasks**

### World-class outcome

Clinic manages **patients**, **appointment tasks**, follow-up care, and optional support cases — with scheduling and strict assignment to practitioners.

### Apps to enable

| Capability | Enable when |
|------------|-------------|
| SALES | People + tasks |
| Scheduling | Patient appointments |
| HELPDESK | Patient queries (non-clinical workflow) |
| DOCUMENTS | Reports, consent forms (operational — not EMR) |

> **Note:** Arivu is CRM/operations — not a certified EMR. Position as patient relationship + scheduling + billing coordination.

### Step-by-step

#### 5.1 People (patients) ⏱ 25 min

1. Custom fields: `dateOfBirth`, `bloodGroup`, `primaryPhysician`, `insuranceProvider`, `patientId` (clinic MRN).
2. Tags: New, Returning, Chronic care.
3. **Profiles** — Restrict sensitive fields to clinical admin role only.

✅ Non-clinical staff cannot view restricted fields.

#### 5.2 Appointment tasks ⏱ 30 min

1. Task type = Appointment; fields: `appointmentType`, `room`, `duration`.
2. Status flow: Scheduled → Checked-in → Completed → No-show.
3. Calendar view by practitioner (`assignedTo`).

✅ Daily agenda per doctor.

#### 5.3 Scheduling ⏱ 25 min

1. Configure practitioner availability + slot length.
2. Public manage/book tokens for patients (if offering online booking).
3. Reminder: automation creates notification 24h before due date.

✅ Booking respects business hours.

#### 5.4 Follow-up care ⏱ 20 min

1. On task Completed → create follow-up Task (+7 days) for chronic patients.
2. Case module for billing/insurance queries only (clear separation from clinical notes).

✅ Completed visit spawns follow-up.

#### 5.5 Commercial (optional) ⏱ 20 min

1. Items: consultation fees, lab packages.
2. Invoice after visit; payment link at reception.

✅ Invoice from completed appointment task link.

#### 5.6 Compliance-oriented ops ⏱ 15 min

1. Audit trail: rely on platform activity timeline (who changed what).
2. Documents: consent PDFs with version history.
3. Trash: use soft-delete only (`deletionService`) — never hard-delete patient records in tests.

✅ Deleted record moves to trash, recoverable.

### UAT script

1. Register 10 patients
2. Book 3 appointments via scheduling
3. Complete visit; verify follow-up task
4. Create insurance query case
5. Generate invoice for consultation

### Success metrics

- No-show rate by appointment type
- Follow-up completion rate
- Average days to next appointment for chronic tags

---

## 6. IT & SaaS Agencies

**Template key:** `saas` · **Primary app:** SALES · **Emphasis:** people, deals, **tasks**

### World-class outcome

Agency/SaaS vendor runs **B2B pipeline** with organizations, scoped deals, delivery tasks, quotes, and optional helpdesk for support retainers.

### Apps to enable

| Capability | Enable when |
|------------|-------------|
| SALES | Pipeline + commercial |
| HELPDESK | Client support retainers |
| PROJECTS | Delivery (if entitled) |
| MARKETING | Nurture campaigns |

### Step-by-step

#### 6.1 Organizations & people ⏱ 30 min

1. Organization types: Prospect, Customer, Partner.
2. Org fields: `annualContractValue`, `techStack`, `contractRenewalDate`.
3. People roles: Decision Maker, Champion, Billing Contact (custom field or tags).
4. Link deals to Organization (primary customer) + People (stakeholders).

✅ Deal shows account hierarchy.

#### 6.2 SaaS sales pipeline ⏱ 25 min

1. Stages: `Discovery → Demo → Proposal → Negotiation → Closed Won → Closed Lost`.
2. Fields: `mrr`, `arr`, `contractTerm`, `champion`, `competitor`.
3. Probability per stage for forecast widgets.

✅ Analytics: pipeline by stage weighted amount.

#### 6.3 Delivery tasks ⏱ 25 min

1. On Won → project Task list template: Kickoff, Implementation, Training, Go-live.
2. Tasks linked to Deal or Organization.
3. Groups: Sales vs Delivery teams with separate permissions.

✅ Won deal triggers task bundle (automation).

#### 6.4 Commercial ⏱ 35 min

1. Quote with line items: setup fee + monthly subscription SKU (catalog items).
2. Quote approval flow if discount > threshold (**Approvals** inbox).
3. Sales Order → Invoice; recurring billing pattern via manual periodic invoices until automated billing integration.

✅ Quote PDF + approval audit trail.

#### 6.5 Helpdesk retainer ⏱ 20 min

1. Cases tied to Customer org; SLA by tier (Gold/Silver).
2. Inbound support email → Case with org matching domain rules.

✅ Email from `@client.com` links to Organization.

#### 6.6 Marketing nurture ⏱ 15 min

1. Audience: Prospects in stage Discovery + Demo.
2. Campaign: case study content (Content Studio article link).

✅ Unsubscribed contacts excluded from send.

### UAT script

1. Create prospect org + 3 contacts
2. Run deal to Closed Won with MRR field
3. Generate quote with approval → invoice
4. Spawn delivery tasks; complete kickoff
5. Log support case for customer org

### Success metrics

- Pipeline coverage (3× quota)
- Won deal → kickoff task within 48h
- Support SLA compliance by tier

---

## 7. Auditing Firms / Inspection Services

**Template key:** `audit` · **Primary app:** **AUDIT** · **Emphasis:** **assignments**

### World-class outcome

Inspection company runs **form-based audits**, field assignments, mobile offline capture, review workflow, and client reporting.

### Apps to enable

| Capability | Enable when |
|------------|-------------|
| AUDIT | Core |
| SALES | Optional client CRM |
| DOCUMENTS | Report PDFs |
| Mobile (`mobile/`) | Field auditors |

### Step-by-step

#### 7.1 Enable AUDIT app ⏱ 10 min

1. **Settings → Apps** — Enable AUDIT for tenant; assign seats.
2. Verify sidebar shows Assignments, Forms (audit surfaces).
3. Founder onboarding goal: **Run audits / inspections**.

✅ Non-audit users lack assignment execute permission.

#### 7.2 Form definitions ⏱ 45 min

1. **Work → Forms** — Create inspection checklist: sections, scoring, pass/fail thresholds.
2. Field types: photo upload, signature, geo location, conditional sections.
3. Publish form version; lock after submissions exist.

✅ Form validates required fields on submit.

#### 7.3 Assignments ⏱ 30 min

1. Create assignment template: site, auditor, due date, form binding.
2. Bulk assign monthly inspections to auditor group.
3. Status lifecycle: Assigned → In Progress → Submitted → Under Review → Approved / Rejected.

✅ Assignment appears in auditor’s mobile/work queue.

#### 7.4 Mobile field execution ⏱ 30 min

1. Install mobile app; login as field auditor.
2. Complete assignment offline; sync when online.
3. Capture photos + GPS; submit response.

✅ Submitted response immutable; visible on web review surface.

#### 7.5 Review & reporting ⏱ 25 min

1. Reviewer role approves/rejects with comments.
2. Export PDF report via Content Studio template or document generation.
3. **Documents** — Archive approved reports by client/site.

✅ Failed inspection triggers escalation task.

#### 7.6 Client CRM (optional) ⏱ 20 min

1. SALES: Organization = client site owner; People = site contacts.
2. Link assignment to Organization record context.

✅ Record page shows related assignments tab.

#### 7.7 Automation ⏱ 15 min

1. Form score below threshold → Case or Task “Remediation required”.
2. Approved → email PDF to client contact via Communications.

✅ Escalation fires on failing score.

### UAT script

1. Register with vertical **Auditing Firms / Inspection Services**
2. Build 20-question form with 1 conditional section
3. Assign to mobile user; complete offline submit
4. Reviewer approves; verify PDF/email
5. Fail second inspection; verify escalation

### Success metrics

- Assignment completion before due date ≥ 95%
- Average submit → approve turnaround
- Offline sync success rate

---

## 8. Automotive Dealers

**Template key:** `automotive` · **Primary app:** SALES · **Emphasis:** people, deals, **organizations**

### World-class outcome

Dealership connects **buyers**, **financing partners (orgs)**, **vehicle catalog**, test-drive events, and deal-to-invoice flow.

### Apps to enable

| Capability | Enable when |
|------------|-------------|
| SALES | CRM + commercial |
| INVENTORY | Vehicle stock (optional) |
| EVENTS | Test drives, launch events |
| MARKETING | Launch campaigns |

### Step-by-step

#### 8.1 Vehicle catalog ⏱ 40 min

1. Items: each model/trim as parent; variant = VIN/spec package/color.
2. Attributes: Make, Model, Year, Fuel, Transmission.
3. Media: exterior/interior gallery per variant.
4. Lifecycle: Available → Reserved → Sold.

✅ Only Available variants appear in deal line picker.

#### 8.2 Organizations ⏱ 20 min

1. Types: OEM, Finance Partner, Insurance Partner, Corporate Fleet.
2. Link deals to finance org when deal field `financingRequired = true`.

✅ Deal shows linked finance partner.

#### 8.3 People & pipeline ⏱ 25 min

1. Person fields: `licenseNumber`, `interestedModel`, `tradeInVehicle`.
2. Deal stages: `Inquiry → Test Drive → Quote → Finance Approved → Delivery → Won`.
3. Deal fields: `vin`, `exShowroomPrice`, `discount`, `deliveryDate`.

✅ Won deal decrements variant lifecycle (manual or automation).

#### 8.4 Events ⏱ 20 min

1. Test drive Events linked to Person + Deal.
2. Task after event: “Send quote within 24h”.

✅ Event completion logged on timeline.

#### 8.5 Commercial ⏱ 30 min

1. Quote with vehicle variant line + accessories + insurance line items.
2. Taxes/charges per regional settings.
3. Invoice on delivery; payment link for booking deposit earlier in pipeline.

✅ Deposit invoice separate from final invoice.

#### 8.6 Automation ⏱ 15 min

1. Stage Test Drive → auto-create quote draft task for sales exec.
2. Reserved variant → block duplicate reservation (process validation).

✅ Second deal cannot attach sold VIN.

### UAT script

1. Load 5 vehicle variants
2. Lead → test drive event → quote → win
3. Verify variant lifecycle Sold
4. Corporate fleet org with multi-deal link

### Success metrics

- Test drive → quote conversion
- Average discount vs target
- Delivery on promised date

---

## 9. Event Management Firms

**Template key:** `events` · **Primary app:** SALES · **Emphasis:** people, **events**, tasks

### World-class outcome

Event agency coordinates **client events** with vendor/org links, run-sheets as tasks, stakeholder people, and sponsorship deals.

### Apps to enable

| Capability | Enable when |
|------------|-------------|
| SALES | Deals + people |
| MARKETING | Event promotion |
| DOCUMENTS | Runbooks, contracts |
| PROJECTS | Complex productions (if entitled) |

### Step-by-step

#### 9.1 Event module setup ⏱ 35 min

1. Event types: Wedding, Corporate, Concert, Exhibition.
2. Event fields: `venue`, `guestCount`, `budget`, `eventDate`, `clientOrganization`.
3. Status: Planning → Confirmed → Live → Wrapped → Cancelled.

✅ Event calendar shows upcoming by date.

#### 9.2 People & organizations ⏱ 25 min

1. People: clients, vendors, performers, guests (segment by tags).
2. Organizations: venues, caterers, AV suppliers — link to Events via relationships.

✅ Event record context shows linked vendors.

#### 9.3 Run-sheet tasks ⏱ 30 min

1. Task template per event type (T-30 days, T-7 days, T-1 day checklists).
2. Automation: Event status → Confirmed spawns task bundle.
3. Assign tasks to production team groups.

✅ 10+ tasks auto-created on confirm.

#### 9.4 Commercial ⏱ 30 min

1. Deal per event: stages `Proposal → Contract Signed → Deposit Received → Final Payment`.
2. Quote line items: venue, catering, production packages (catalog or manual lines).
3. Deposit invoice at contract; balance invoice post-event.

✅ Deal amount tracks budget field on Event.

#### 9.5 Documents ⏱ 15 min

1. Folders per event: Contract, Runbook, Permits.
2. E-sign on contract document if enabled.

✅ Contract attached to Deal + Event.

#### 9.6 Marketing ⏱ 15 min

1. Campaign for public events (ticket sales webform → People).
2. Audience: attendees of prior similar events.

✅ Registration webform tags source correctly.

### UAT script

1. Create corporate event 60 days out
2. Confirm → verify run-sheet tasks
3. Link 3 vendor orgs
4. Quote → deposit invoice
5. Mark event Wrapped; close tasks

### Success metrics

- Task completion rate T-7 checklist
- Budget vs actual on deal
- Client repeat events within 12 months

---

## 10. Pest Control / Facility Maintenance

**Template key:** `field_service` · **Primary app:** SALES · **Emphasis:** people, **tasks**

### World-class outcome

Field service operator runs **service contracts**, **recurring visit tasks**, route-friendly mobile workflow, and optional cases for emergencies.

### Apps to enable

| Capability | Enable when |
|------------|-------------|
| SALES | Accounts + tasks |
| Mobile | Field technicians |
| HELPDESK | Emergency calls |
| INVENTORY | Chemicals/parts (optional) |
| AUDIT | Compliance checklists (optional) |

### Step-by-step

#### 10.1 Organizations (sites) ⏱ 25 min

1. Organization = commercial site or residential account; fields: `serviceAddress`, `accessInstructions`, `contractTier`.
2. People = site contact; link to org.

✅ Multiple sites under one corporate org.

#### 10.2 Service tasks ⏱ 35 min

1. Task types: Initial treatment, Recurring visit, Emergency call-out.
2. Fields: `serviceWindow`, `technician`, `chemicalsUsed`, `nextVisitDate`.
3. Recurring pattern: automation creates next visit on task Complete (+30/60/90 days).

✅ Completing visit schedules next visit automatically.

#### 10.3 Mobile execution ⏱ 25 min

1. Technician sees today’s tasks on mobile.
2. Check-in at site (geo on task completion notes).
3. Capture customer signature photo on complete.

✅ Mobile sync updates web task status.

#### 10.4 Contracts & deals ⏱ 25 min

1. Deal = annual contract; Won triggers recurring task series.
2. Invoice monthly/quarterly from contract deal amount.

✅ Won contract spawns 12 visit tasks.

#### 10.5 Inventory (optional) ⏱ 20 min

1. Items: chemicals, traps, PPE.
2. Deduct stock on task completion via inventory adjustment integration.

✅ Stock reflects usage per visit.

#### 10.6 Emergency helpdesk ⏱ 15 min

1. Case type Emergency; SLA 4 hours.
2. Case → spawns urgent Task assigned to on-call group.

✅ Emergency case creates same-day task.

#### 10.7 Compliance audits (optional) ⏱ 20 min

1. AUDIT form: safety checklist per visit type.
2. Attach form response to Task record context.

✅ Failed checklist blocks task complete until remediated.

### UAT script

1. Create org with 2 sites
2. Win annual contract deal
3. Complete visit on mobile; verify next visit scheduled
4. Log emergency case → urgent task
5. Monthly invoice generated

### Success metrics

- Recurring visit adherence ≥ 98%
- Emergency response within SLA
- Contract renewal rate

---

## 11. Generic / Default (sales_default)

**When:** Vertical not listed or general B2B CRM trial.

### Step-by-step ⏱ ~2 hours

1. Complete **Shared foundation** (F1–F6).
2. **People** — minimal custom fields; enable lead status in SALES participation.
3. **Deals** — standard 5-stage pipeline; enable AUTO amount from lines if using catalog.
4. **Tasks** — follow-up calls on stage changes.
5. **Assignment rules** — round-robin leads.
6. **Import** — 20-row CSV smoke test.
7. **Analytics** — pipeline + activity dashboard.
8. Accept **sample data** on onboarding to validate template `sales_default`.

### UAT script

Register without caring about vertical label → create contact + deal → import CSV → invite teammate → complete Platform Home checklist 4/6.

---

## World-class polish (all verticals)

Apply before customer handoff:

| Area | Action |
|------|--------|
| **Naming** | Module labels match customer vocabulary (Settings → Module display names) |
| **Required fields** | Only require what users can consistently fill |
| **Picklists** | Curated, non-overlapping values; no free-text where picklist suffices |
| **Pipeline** | ≤8 deal stages; each stage has clear exit criteria documented |
| **Permissions** | Least privilege; test with `User` role not just `Owner` |
| **Empty states** | Primary modules show next-best-action links |
| **Notifications** | Rules don’t spam; digest for low-priority |
| **Business hours** | Match customer operations before SLAs |
| **Trash policy** | Train users on soft-delete recovery |
| **Mobile** | If field/mobile vertical, test offline on real device |
| **i18n** | If multi-language, run `npm run i18n:check` before go-live |
| **Backups** | Document export procedure (CSV + commercial PDFs) |

---

## Team lab schedule (suggested)

| Week | Activity |
|------|----------|
| 1 | Shared foundation + Retail + Real Estate labs |
| 2 | Services + Education + Healthcare labs |
| 3 | SaaS + Automotive + Events labs |
| 4 | Audit + Field Service labs + polish review |

Each engineer owns one “golden tenant” and demo script for their vertical.

---

## Related docs

- [VERTICAL_IMPLEMENTATION_GUIDE.md](./VERTICAL_IMPLEMENTATION_GUIDE.md) — strategy & architecture
- [Architecture_Document.md](./Architecture_Document.md) — platform capabilities
- [USER_ONBOARDING_ARCHITECTURE.md](./USER_ONBOARDING_ARCHITECTURE.md) — onboarding behavior
- [module-settings-doctrine.md](./architecture/module-settings-doctrine.md) — settings vs work boundaries
