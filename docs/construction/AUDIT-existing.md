# What FieldQuo already has, against ServiceTitan's construction set

Research only. Nothing in the product was changed to write this. Every verdict
below is backed by a file and a line; where I could not settle something I have
said so at the bottom rather than rounding it up to a "partial".

Read before anything else: **`lib/marketing/competitors.js:744` already holds a
FieldQuo capability map with `has: true/false` and an evidence string per row**,
written for the sales comparison pages. Four of the ten questions in this brief
already have an answer there (`gantt_charts`, `purchase_orders`, `daily_logs`,
`geofencing` — all `has: false`, lines 776–799). I re-derived each one
independently rather than quoting it, and every one held. That file is a
maintained asset and should be updated alongside anything built from this audit,
or the sales pages will start claiming things that changed.

Vocabulary used below:

- **BUILT** — works end to end and is reachable from a screen.
- **PARTIAL** — real, incomplete; the exact missing piece is named.
- **DEAD** — a column written and never read, or read and never written.
- **ABSENT** — no model, no code, nothing under another name.

---

## Summary table

| # | Capability | Verdict |
|---|---|---|
| 1 | Change orders | **PARTIAL** — a log, not a financial instrument |
| 2 | Document management | **ABSENT** (photos and PDF *rendering* exist; a document *store* does not) |
| 3 | Daily logs | **PARTIAL** — the parts exist, the day-shaped record does not |
| 4 | Time tracking | **BUILT**; geolocation **DEAD**; geofencing **ABSENT** |
| 5 | Per-job financials | budget-vs-actual **BUILT**; progress billing **BUILT**; schedule of values / retainage **ABSENT** |
| 6 | Crew and scheduling | **PARTIAL** — one assignee per visit, no crew entity |
| 7 | Fleet / vehicles | **PARTIAL** — a vehicle is an `Asset` row with `category: "vehicle"` |
| 8 | Inventory / PO / suppliers | purchasing **PARTIAL**; stock **ABSENT**; PO **ABSENT**; `Material.reorderThreshold` **DEAD** |
| 9 | Service agreements | **BUILT** — the most complete thing in this audit |
| 10 | Client-site equipment + warranty history | **ABSENT** |

---

## 1. Change orders — PARTIAL

**The owner is right that they exist.** They are more real than most things in
this audit: a model, a route, a screen, a KPI, and a written design rationale.
What they are *not* is a number that moves money.

### What is genuinely there

- **Model** — `prisma/schema.prisma:3760`. `jobId`, `description`,
  `priceDelta Decimal(12,2)` (line 3771), `createdById`, `createdAt`. Deliberately
  append-only: no `status`, no edit, no delete.
- **API** — `app/api/jobs/[id]/change-orders/route.js`. `GET` + `POST` only.
  Gated on `jobs:view_create_edit` **and** the `showPricing` toggle, because a
  `priceDelta` is money (route lines 54–62).
- **Screen** — `app/components/jobs/ChangeOrders.js`, mounted unconditionally on
  the job page at `app/app/jobs/[id]/JobDetail.js:541`, fed by the job GET's own
  include at `app/api/jobs/[id]/route.js:61`. Full create form, permission-aware,
  `reportResponseError` on failure. Not a dead button.
- **KPI** — `buildChangeOrderRate` at `lib/analytics/kpis.js:808`, rendered on
  `app/app/analytics/kpis/page.js:857`.
- **Design write-up** — `docs/CALLBACKS-AND-CHANGE-ORDERS.md`, which argues
  correctly that a quote is edited in place with no history and that invoice
  versioning fires on *any* edit, so neither can be mined for change orders.

### What makes it PARTIAL, precisely

**`priceDelta` never reaches a total.** Three independent checks:

1. **Job costing ignores it.** `app/api/jobs/[id]/costing/route.js:170` sets
   revenue to `job.quote?.total` and nothing else. A job quoted at $10,000 with
   $4,000 of agreed change orders still reports $10,000 of revenue, so the
   margin on the job page is wrong by the full amount of every change order.
2. **Invoicing ignores it.** Grepped `changeOrder|priceDelta` across `app/`,
   `lib/`, `components/`, `scripts/`: ten files, none of them under
   `app/api/invoices/`, `lib/invoices/` or `lib/documentSections/`. Nothing
   carries a change order onto an invoice, a PDF or an email.
3. **Progress billing ignores it.** `JobPaymentStage.amountCents`
   (`prisma/schema.prisma:2580`) is computed once from the quote's accepted
   total and, by its own comment, "never recomputed afterwards … the total it is
   a percentage OF cannot change post-acceptance." A change order is exactly the
   event that makes that premise false.

**The only consumer sums it and then discards the sum.** `buildChangeOrderRate`
computes `raw.totalPriceDelta` (`lib/analytics/kpis.js:811–828`) — and the only
readers of `totalPriceDelta` anywhere are two assertions in
`scripts/check-kpis.mjs:636,716`. The KPI page renders the *rate* (a percentage
of jobs), never the money. So the dollar figure is written, aggregated, and
displayed nowhere. That single field is DEAD inside an otherwise PARTIAL feature.

**Nothing client-facing.** No approval, no signature, no PDF, no email, no client
portal surface. `app/portal/[token]/ClientPortal.js` renders exactly two
sections — invoices (line 209) and quotes (line 271). A homeowner cannot see or
sign a change order; the record asserts agreement that happened over the phone.

**Verdict:** an honest internal audit trail with a rate metric. Not a change
order in the ServiceTitan sense, where the document changes the contract value
and flows to the invoice.

---

## 2. Document management — ABSENT

**`lib/documents/` is document *rendering*, and the brief was right to suspect
it.** Its nine files are `contractTerms.js`, `issueDate.js`,
`loadServiceSettings.js`, `paymentSchedule.js`, `serviceContent.js`,
`signatureAudit.js`, `taxId.js`, `templateKind.js`, `theme.js` — PDF/email
composition and branding. `lib/documentSections/` is the shared section registry
for quotes and invoices. Neither stores a file.

### The only real file store, and why it does not count

`MigrationDocument` (`prisma/schema.prisma:3276`) is the one model with
`url` + `publicId` + `filename` + `resourceType` + `bytes`. It belongs to
`MigrationRequest` — the paid superadmin data-migration service (non-negotiable
#3). It is not reachable by a contractor for their own job files.

### What a contractor can actually attach

- **Photos and videos on a job** — `JobPhoto` (`prisma/schema.prisma:7401`).
  Rich: stage, caption, tags, comments, mentions, Fabric annotation layer.
- **One PDF per media slot on a quote / invoice / lead** — `clientPhotos Json`
  carries `{ url, kind, publicId }` where `kind` may be `"document"`
  (`lib/media/validate.js:60`, `DOCUMENT_TYPES = new Set(["application/pdf"])`;
  rendered by `app/components/ClientMediaTile.js:63`). PDFs only, no other type.
- **Expense receipts** via the CSV import batch (`ExpenseImportBatch.filename`,
  `prisma/schema.prisma:5034`).

### What does not exist

No folders. No versions. No search. No sharing. No document model on `Job` or
`Client` at all. No "Documents" entry in the sidebar
(`app/components/layout/AdminSidebar.js:114–207` — I read the whole nav). Plans,
permits, specs, submittals, signed contracts and warranties have nowhere to live
except a PDF wedged into a quote's photo array.

`app/api/upload/route.js` is the only upload path and is signed and
authenticated, so the plumbing for a real store is in place; the store is not.

---

## 3. Daily logs — PARTIAL

There is no `DailyLog` model and no `dailyLog` identifier anywhere. But the
brief is right that the pieces are close, and the closest piece is `JobVisit`.

### What a `JobVisit` already is (`prisma/schema.prisma:3707`)

`scheduledAt`, `assignedToId`, `status`, `checklistItems Json`,
`photos String[]`, `notes`, plus `returnReason`/`returnNotes`. Its own header
says it is "one day of a longer job somebody wants tracked with its own
checklist and photos" — i.e. it was *designed* as the day record.

Around it:

- **Status moves** — `app/components/jobs/VisitStatus.js`, scheduled → on the way
  → done, and "on the way" texts the homeowner.
- **Checklist ticking** — `app/components/jobs/VisitChecklist.js`, with a seeded
  per-trade template library (`prisma/seed-construction-checklists.js`).
- **Photos arriving from the field by text** — the crew inbox. A crew member
  texts a photo, `lib/crew/attribution.js` picks the job, `lib/crew/inbox.js:330`
  `fileToVisit` appends it to `JobVisit.photos` **and** writes a `JobPhoto` row
  with an inferred stage. This is genuinely good and is the hardest part of a
  daily log to build.
- **The recap already exists as a document** — `lib/jobs/photoReport.js` +
  `app/api/jobs/[id]/photo-report/pdf/route.js` produce a dated, stage-grouped
  photo report PDF, surfaced from `app/components/jobs/JobPhotoTimeline.js`.

### The exact thing that is missing

**Nobody can write down what happened.** `JobVisit.notes` is written only at
*creation*, from `app/app/jobs/[id]/visits/new/page.js:142`, and its own
placeholder is `"Gate code, where to park, who to ask for"` (line 246) — a
pre-visit brief. It is rendered afterwards on the job page
(`app/app/jobs/[id]/JobDetail.js:646`), and the PATCH route accepts a `notes`
field (`app/api/jobs/[id]/visits/[visitId]/route.js:57,83`) — but **no UI ever
sends it**. `VisitChecklist.js` sends only `checklistItems`; `VisitStatus.js`
sends only `status`. So the write path exists in the API and has no caller.

Also missing from a real daily log: crew present that day, hours on site,
weather, delays/blockers, materials delivered, visitor/inspection log. Hours
exist (`TimeEntry`) but are not joined to a visit — `TimeEntry` has `jobId`, not
`jobVisitId` (`prisma/schema.prisma:4825`).

**Nearest thing to an automated recap** is `AiDigest`
(`prisma/schema.prisma:5788`), which is company-wide and **monthly**
(`app/api/cron/monthly-digest/route.js:14`), not per job per day.

**Verdict: PARTIAL, and cheap to finish.** Photos + attribution + checklist +
report PDF is roughly 80% of it. What is missing is a text field a crew member
can fill in from a phone at the end of the day, and a per-day roll-up view.

---

## 4. Time tracking and geolocation — clock BUILT, geolocation DEAD, geofencing ABSENT

### Time tracking — BUILT

- **Model** — `TimeEntry` (`prisma/schema.prisma:4825`): `workerId`, `jobId?`,
  `clockIn`, `clockOut`, `hours`, `approvedById`, `status`.
- **Self-serve clock** — `app/app/clock/page.js` → `app/api/time-clock/route.js`.
  Worker is resolved from the session, never from the request.
- **Manager timesheets** — `app/api/time-entries/route.js` (POST accepts
  `workerId`, `jobId`, `clockIn`) and `[id]/route.js` (PATCH/DELETE), screen at
  `/app/settings/team/timesheets`.
- **Payroll consumes it** — `lib/payroll/buildPayRun.js:150,159,187`
  (`timeEntry.groupBy`, then approved rows), `lib/payroll/stripeConnectPayout.js:50`,
  `app/api/payroll/my-payslips/route.js:157,168`.
- **Job costing consumes it** — `lib/costing/actualJobCost.js`, approved hours
  only, unrated workers counted with zero cost and flagged.

**One real gap:** the self-serve clock cannot attach a job.
`app/app/clock/page.js:63` posts `JSON.stringify({ action })` — no `jobId` — and
`app/api/time-clock/route.js` contains no `jobId` at all. Only a manager
entering time through `/api/time-entries` can attribute hours to a job. So the
labour half of every job's actual cost depends on office data entry, not on what
the crew punched.

### Geolocation — DEAD, and this is the sharpest finding in the audit

Coordinates exist in exactly one place on this path:
`CrewInboundMessage.latitude/longitude` (`prisma/schema.prisma:7359–7360`),
populated from an MMS's `Latitude`/`Longitude` params
(`lib/crew/inboundParse.js:126–130`, called at
`app/api/crew/inbound/route.js:181`).

`lib/crew/attribution.js` has a complete, careful GPS matcher — `GPS_ONSITE_KM =
0.25`, a 2× separation rule against the runner-up, `method: "gps"` at line 178.

**It can never fire.** The candidate builder at `lib/crew/inbox.js:163` returns
`lat: undefined, lng: undefined` for every job, with an honest comment above it
explaining why: there is no geocoded point on a job visit, and the client's
billing address would be wrong for a company client worked at a different site
each week. `gpsMatch` drops candidates without a point, so it returns `null`
every time and attribution always falls through to text matching.

So `CrewInboundMessage.latitude/longitude` is written and read only for display
(`app/api/crew/messages/route.js:56,107`), and `method: "gps"` is a value the
system cannot produce. **The blocker is not the GPS code — it is that no job or
visit has a site address, let alone coordinates.** See §11 below.

### Geofencing — ABSENT

No `geofenc*` anywhere outside `node_modules`. No arrival detection, no
clock-in-at-site rule, no coordinate capture on a punch. Corroborated by
`lib/marketing/competitors.js:794`.

---

## 5. Per-job financials — budget-vs-actual BUILT, progress billing BUILT, schedule of values / retainage ABSENT

### Budget vs actual per job — BUILT

This is better than the brief assumes, and it is genuinely per-job, not just
company-wide KPIs.

- **Route** — `app/api/jobs/[id]/costing/route.js`, gated on the `jobCosting`
  toggle so someone who cannot see margin on a quote cannot see it on the job.
- **Screen** — `app/components/jobs/JobCosting.js`, mounted at
  `app/app/jobs/[id]/JobDetail.js:536`.
- **Actuals** — `lib/costing/actualJobCost.js`: expenses tagged to the job, plus
  **approved** hours only, plus overhead per job from
  `lib/analytics/minimumPrice.js`, plus optional equipment allocation with an
  explicit double-count guard.
- **Budget** — `quotedCostFor` reads the `QuoteCosting` snapshot
  (`prisma/schema.prisma:2895`) written when the quote was saved, so the variance
  is against what the estimator actually committed to, not what today's price
  book would say.
- **Comparison** — `compareJobCost` (`lib/costing/actualJobCost.js:217`) returns
  variance, variance %, profit and margin %, with nulls rather than fake zeros.

Cross-job views exist too: `lib/analytics/estimateAccuracy.js` and
`lib/analytics/kpis.js`.

**The two holes in it**, both already noted above: revenue is `quote.total` and
nothing else (line 170), so change orders are invisible and a job with no quote
has no revenue at all; and job labour depends on a manager attributing hours,
because the clock cannot.

### Progress billing — BUILT

Real, and end to end.

- `PaymentScheduleStage` (`prisma/schema.prisma:2538`) — the company's template:
  `seq`, `label`, `trigger` (`on_invoice_created | job_start | halfway |
  job_end`), `percentage`, which must sum to 100.
- `JobPaymentStage` (`prisma/schema.prisma:2580`) — the job's frozen copy, with
  `dueDate` recomputed for pending stages as the job's dates move, a
  `blockedReason` so a stuck stage says why, and `amountCents` frozen at creation.
- One invoice, billed in stages — each stage requests its share through a Stripe
  Checkout session capped to that amount, never the full balance.
- `lib/paymentSchedule/run.js:241` actually sends the email and sets
  `requestedAt` at line 277; driven by `app/api/cron/payment-schedule/route.js`.
- Screen: `app/app/jobs/[id]/PaymentScheduleCard.js`.

**But it is percentage-of-total on date triggers, not a schedule of values.**
There is no per-line-item or per-phase % complete, no stored quantities-to-date,
no application-for-payment document.

### Schedule of values / retainage — ABSENT

`retainage` and `holdback` occur only in marketing copy —
`app/data/tradeGlossary.js`, `app/(marketing)/glossary/*`. No column, no
calculation, no withholding anywhere in invoicing. Same for `submittal` and
`prevailing` wage. There is no certified-payroll concept.

---

## 6. Crew and scheduling — PARTIAL

**The shape, plainly: there is no crew entity.** "Crew" in this codebase means
two unrelated things.

1. **A costing construct.** `QuoteCosting.crew Json` (`prisma/schema.prisma:2909`)
   and `InvoiceCosting.crew Json` (line 2445) hold a list of
   `{ name, rate, hours }` per document, priced by `lib/costing/crew.js`. Not a
   roster; a named list on one quote.
2. **The crew inbox** — texting photos in. Unrelated to assignment.

### What actually assigns work

- **`JobVisit.assignedToId`** — exactly one user per visit
  (`prisma/schema.prisma:3712`). This is also the access-control spine:
  `assignedJobWhere` (`lib/permissions/enforce.js:228`) scopes a crew member to
  jobs that have a visit assigned to them, and a job with no visits is
  deliberately invisible to them.
- **`Shift`** (`prisma/schema.prisma:4845`) — one worker, start/end, optional
  `jobId`, `published` flag so a half-built week stays hidden, and a genuinely
  thoughtful `availabilityOverrideAt` trail. Screen: `/app/scheduler`.
- **`WorkArea` / `WorkAreaAssignment`** (`prisma/schema.prisma:3400,3412`) — a
  many-to-many of users to named areas, used to scope `Task`.
- **Calendar** — `lib/schedule/jobVisits.js` unions `JobVisit`, `Appointment` and
  `Booking` at read time rather than duplicating rows, and carries `kind` so
  nothing offers an editor that would 404.
- **Availability** — `AvailabilitySchedule` / `WorkingHours` per user, plus
  `LeaveRequest` / `LeaveBalance` / `LeavePolicy`, and a manager view at
  `/app/schedule`.

### What is missing for construction

No crew/team as a first-class object you assign as a unit. No multi-assignee
visit — a three-person crew on Tuesday needs three shifts and one visit assignee,
and the visit's assignee is what governs who can see the job. No dispatch board,
no drag-to-reassign, no route ordering for the day (`lib/marketing/routeOrder.js`
exists but is for pamphlet drops). No skills/certifications on a worker, so
nothing can say who is allowed on which job. No task dependencies or critical
path — corroborated by `lib/marketing/competitors.js:776`.

---

## 7. Fleet / vehicles — PARTIAL

**A vehicle is an `Asset` row.** `Asset` (`prisma/schema.prisma:5470`) carries
`name`, `cost`, `salvageValue`, `inServiceDate`, `usefulLifeMonths`,
`disposedOn`, `active`, `debtId` (the loan that bought it, which is the
double-count guard), and free-text `category`.

`"vehicle"` is a first-class category with a 60-month suggested life —
`ASSET_CATEGORIES` at `lib/costing/assetLifeSuggestions.js:38`, alongside
`trailer` at 120. The suggestion pre-fills the form and is never written silently.

- **Register screen** — `/app/settings/overhead` (`app/app/settings/overhead/page.js:186,244`),
  backed by `app/api/assets/route.js`, `[id]/route.js`, `utilisation/route.js`.
- **Depreciation** — `lib/accounting/depreciation.js`, folded into
  `lib/analytics/burnRate.js` → `lib/analytics/minimumPrice.js` → the price floor.
  So a truck really does raise what a job must be priced at.
- **Per-job use** — `AssetUseLog` (`prisma/schema.prisma:5558`), one row per
  (asset, job, day), logged from `app/components/jobs/EquipmentUseLog.js`
  (mounted at `JobDetail.js:553`).

**What is missing** is everything vehicle-specific: no VIN, plate, odometer,
fuel, insurance renewal, registration expiry, inspection date, maintenance
schedule, driver assignment, or GPS/telematics. And note the sidebar has no
Equipment entry at all — the register lives inside Settings → Overhead, which is
a discoverability problem for a feature a construction buyer will ask to see.

---

## 8. Inventory, purchase orders, suppliers — mixed

### Purchasing per job — PARTIAL, and better than it sounds

`JobMaterial` (`prisma/schema.prisma:3654`) is a real sourcing list: `name`,
`qty`, `unit`, `categoryKey`, `estUnitCost`, `actualCost`, `supplier`,
`purchasedAt`, `purchasedById`, `addedByHand`.

- Lines are derived from the quote's bill of materials
  (`lib/jobs/sourcingList.js`, `lib/costing/tradeMaterials.js`), and regenerating
  never destroys a purchased or hand-added line.
- Ticking a line off with a receipt total writes a `MaterialPriceEntry` and
  recomputes `Material.currentAvgCost` from *every* entry
  (`lib/jobs/sourcingList.js:167–197`), so real receipts improve future estimates.
- Screen: `app/components/jobs/JobMaterials.js`, mounted at `JobDetail.js:547`.

### Suppliers — PARTIAL, as free text only

`JobMaterial.supplier` and `MaterialPriceEntry.supplier` are both `String?`
(`prisma/schema.prisma:3675`, `5769`). There is no `Supplier` model, no contact
details, no per-supplier price list, and no way to see "everything we bought from
this supplier". Typos make two suppliers.

### Stock tracking — ABSENT

No quantity on hand, no warehouse/truck stock, no transfers, no consumption
against a job. `Product` (`prisma/schema.prisma:14`) is a catalogue row —
`unitPrice`, `costPrice`, `unit`, `active` — with no quantity field at all.

### Reorder — DEAD

`Material.reorderThreshold Decimal?` (`prisma/schema.prisma:5754`) is **written
by nothing and read by nothing**. Grepped the identifier across `app/`, `lib/`,
`scripts/` and `prisma/`: zero hits outside the schema. This is a textbook
instance of recurring failure class #1. It is invisible to a user today (no UI
renders it), so it is a schema wart rather than a lying control — but it should
either be wired up or dropped.

### Purchase orders — ABSENT

No `PurchaseOrder` model, no `purchaseOrder` identifier. "Purchase order" occurs
only as a price-book line item in `app/data/tradePriceBooks.js` and as a
checklist row. Corroborated by `lib/marketing/competitors.js:782`.

---

## 9. Service agreements / memberships / recurring work — BUILT

`ServicePlan` is the most complete feature in this audit, and it does
substantially more than the brief implies.

- **`ServicePlan`** (`prisma/schema.prisma:7654`) — `serviceName` frozen as text
  at creation (a renamed trade must not rewrite what a homeowner bought),
  `frequency` (weekly → annual), `startDate` as an anchor every later date is
  computed from (so a "31st" plan does not drift), `endMode` = `count | until |
  open`, `amountPerOccurrence`, `discountPct` applied per occurrence so each
  invoice adds up on its own, `taxRatePct` nullable meaning "the contractor said
  there is no tax", `collectionMode` = `invoice | automatic`, `language` fixed at
  creation, and an `authToken` minted only when a payment method is actually
  requested.
- **`ServicePlanOccurrence`** (line 7755) — created lazily, one per run, with
  `@@unique([planId, seq])` making the cron idempotent. Statuses
  `pending | invoiced | charging | paid | failed`, where `charging` exists because
  pre-authorised debit sits in `processing` for days and collapsing it into `paid`
  would mark an invoice settled on money that has not moved.
- **`ServicePlanAuthorisation`** (line 7815) — a separate row precisely so
  "is there a mandate" has one answer, holding the Stripe customer/setup
  intent/payment method and a snapshot of the exact `termsText` the client ticked.
- **`collectionMode: "automatic"` is explicitly a request, not a capability** —
  without an unrevoked authorisation the run falls back to the pay link and says
  so. That is the opposite of the dead-control failure.
- **Wired end to end** — `lib/servicePlans/{run,schedule,pricing,consent,
  authorisation,stripeMandate,summary,validate}.js`,
  `app/api/cron/service-plans/route.js`, `app/api/stripe/webhook/route.js`
  (`settleOccurrenceFromIntent`), screens at `/app/plans` and the client
  authorisation page at `/plan/<token>`, nav entry at
  `AdminSidebar.js:121`.

**What it is not:** a *membership* in the ServiceTitan sense. There is no
entitlement — no discount rate applied to other work, no priority scheduling, no
included visits drawn down, no renewal/expiry with a lapse state. It sells a
recurring package and bills it; it does not confer benefits on unrelated jobs.
Also, a plan does not generate `Job` or `JobVisit` rows — it generates invoices.
The work still has to be scheduled by hand.

---

## 10. Equipment and warranty history at a client site — ABSENT

There is no model for a thing installed at a client's property. `Client`
(`prisma/schema.prisma:1818`) holds one address, contact details, language and a
portal token, and relations to quotes, invoices, jobs, appointments, tasks,
pamphlet stops, service plans and satisfaction responses. Nothing for equipment.

- No serial number, model number, manufacturer, install date, or location field
  exists anywhere in the schema (grepped `serialNumber`, `manufacturer`,
  `installedOn` — zero hits).
- **No warranty period exists anywhere in the product.** Every `warranty` hit in
  the schema is either a contract-template placeholder
  (`lib/documents/contractTerms.js`: "Warranty: [state your own term…]"), a
  saleable line item (`lib/pricing/tradeScope.js`'s `warrantyVisits`), or the
  string `"warranty"` as a *callback reason*
  (`prisma/schema.prisma:3543,3722`; `lib/jobs/callbackReasons.js`). The
  `JobVisit.returnReason` comment at line 3728 says so outright: "nothing in the
  schema knows a warranty period (grepped for one before writing this — there
  isn't one)".
- Service history at an address is reconstructable only by listing that
  `Client`'s jobs — which is wrong for a company client with many sites, and
  cannot answer "this furnace" at all.

`Asset` is the company's *own* equipment (depreciation, overhead, job
allocation). It has no client relation and is the wrong shape for this: a
homeowner's furnace is not a depreciating asset of the contractor's.

---

## 11. The finding underneath four of the others: a job has no site address

Worth stating separately, because it is the shared root of the geolocation gap,
the client-site-equipment gap, and part of the crew/dispatch gap.

- `Job` (`prisma/schema.prisma:3427`) has no address and no coordinates.
- `JobVisit` (line 3707) has no address and no coordinates.
- `Quote` (lines 1877–2163) has no address either — I read the whole block; the
  single `address` hit in it is the *email* address captured at send time.
- The job page's map link therefore uses the **client's billing address**:
  `formatAddress(job.client)` at `app/app/jobs/[id]/JobDetail.js:506,515`.

**And there is a wrong load-bearing comment about this.** `Client.type`'s comment
at `prisma/schema.prisma:1820–1824` says a company client's "`address` is just
their office and the real work location is set per quote/job instead." No such
field exists on either. AGENTS.md asks that a wrong comment be fixed along with
the code; I have not touched it (research only), but it should be corrected
whether or not anything is built here.

For commercial and construction work this is the single most structural gap in
the audit: a GC client is billed at an office and worked at a different site
every week, and FieldQuo has nowhere to record where.

---

## The cheapest real wins

Ordered by effort. Each is small because the hard part already exists.

1. **Make a change order move the money.** Add `sum(priceDelta)` to the revenue
   passed into `compareJobCost` at `app/api/jobs/[id]/costing/route.js:170`, and
   surface `raw.totalPriceDelta` — already computed at
   `lib/analytics/kpis.js:828` and currently read only by a test — on the KPI
   page beside the rate. Two small edits, and the job margin stops being wrong by
   the value of every agreed change. Touches: one route, one page,
   `scripts/check-kpis.mjs`. *(Invoicing is a separate, larger decision — see
   below.)*
2. **A visit note a crew member can write after the visit.** The PATCH route
   already accepts `notes` (`app/api/jobs/[id]/visits/[visitId]/route.js:57,83`)
   and the job page already renders it (`JobDetail.js:646`). What is missing is a
   textarea in `VisitChecklist.js`. This is a write path with no caller — the
   cheapest thing in this document, and it turns a visit into a daily log entry.
3. **Kill or wire `Material.reorderThreshold`** (`prisma/schema.prisma:5754`).
   Written by nothing, read by nothing. Dropping it is a one-line schema change;
   wiring it needs stock levels, which do not exist — so drop it.
4. **A "day on this job" roll-up view.** Every ingredient exists: `JobVisit`
   (checklist, photos, notes, status), `JobPhoto` with stage and timestamp,
   `TimeEntry` by date, `JobMaterial.purchasedAt`, `AssetUseLog.usedOn`,
   `SafetyIncident`. Group by date on the job page and the daily log is largely
   built from data already being captured. Touches: one new route, one component.
   The photo-report PDF (`lib/jobs/photoReport.js`) is the template for a
   printable version.
5. **Let the time clock attach a job.** `app/app/clock/page.js:63` posts only
   `{ action }`; `TimeEntry.jobId` already exists and job costing already reads
   it. Add a job picker (scoped by `assignedJobWhere`) and the labour half of
   every job's actual cost stops depending on office data entry. Touches: one
   page, one route.
6. **Fix the `Client.type` comment** at `prisma/schema.prisma:1820–1824`, which
   describes a per-job work location that does not exist.
7. **Surface the equipment register in the nav.** It works, and it is buried in
   Settings → Overhead. One line in `AdminSidebar.js`.

## The genuinely large builds

1. **A job-site address, geocoded.** The prerequisite for a great deal else.
   Touches: schema (`Job` and/or `JobVisit`, or a `Site`/`Property` model hung
   off `Client`), job and quote creation and edit forms, the Google Places
   autocomplete already used elsewhere, `lib/crew/inbox.js:163` (which would
   finally let the existing GPS matcher at `lib/crew/attribution.js:172` work),
   the calendar entries in `lib/schedule/jobVisits.js`, the job page's map link,
   and every client-facing document that prints an address. A `Property` model is
   also the natural home for §10's site equipment, so these two should be scoped
   together or the second one will be rebuilt.
2. **Change orders as a contract instrument rather than a log.** Client-visible,
   approvable/signable (the signature machinery exists —
   `lib/documents/signatureAudit.js`, `lib/documentSections/SignatureSection.js`),
   flowing into the invoice and into `JobPaymentStage.amountCents`. That last part
   is the hard bit: `JobPaymentStage`'s own comment states the accepted total
   cannot change post-acceptance, so admitting change orders means revisiting
   that invariant and deciding what a mid-schedule total change does to stages
   already requested. This is a product decision before it is code. Touches:
   `ChangeOrder` schema (status, approval, token), a public approval route, the
   invoice builder, `lib/paymentSchedule/*`, `app/api/jobs/[id]/costing/route.js`,
   the client portal, PDF sections.
3. **Document management.** A `Document` model (owner: company / client / job /
   quote), folders or tags, versions, sharing to the portal, and search. The
   upload plumbing (`app/api/upload/route.js`, Cloudinary, `lib/media/validate.js`)
   is sound, but `classifyMedia` currently allows exactly one document type
   (PDF), so the allowlist and the size ceilings need revisiting. Touches: schema,
   a new nav section and screens, `lib/media/validate.js`, the client portal, and
   the permission grid.
4. **Client-site equipment with service and warranty history.** Depends on build
   #1. Needs an equipment record at a property, a link from `Job`/`JobVisit` to
   the equipment serviced, and a warranty period — the first one this product
   would have. Note AGENTS.md's padding rule: a missing warranty term must stay
   missing, never a defaulted twelve months.
5. **Inventory and purchase orders.** A `Supplier` model (replacing two free-text
   columns), stock locations including van stock, `PurchaseOrder` with lines and
   receiving, and consumption against `JobMaterial`. Touches: schema heavily,
   `lib/jobs/sourcingList.js`, `lib/costing/tradeMaterials.js`, expenses (a
   received PO becomes an `Expense`), and job costing. The largest schema change
   in this list.
6. **Crew as an entity, and a dispatch board.** A crew with members and a lead,
   multi-assignee visits, and — importantly — a rethink of
   `assignedJobWhere` (`lib/permissions/enforce.js:228`), because visit assignment
   is currently load-bearing for access control and cannot simply be widened.
   Add skills/certifications if the goal is "who may work this job". Touches:
   schema, the permission layer, the scheduler, the calendar union, and the crew
   inbox's candidate resolution.
7. **Schedule of values, progress claims and retainage.** Per-line-item or
   per-phase % complete, application-for-payment documents, and a withheld
   percentage released at completion. The existing payment schedule
   (`PaymentScheduleStage` / `JobPaymentStage`) is the wrong shape to extend — it
   is percentages of one total on date triggers — so this is a parallel model, not
   a widening. Touches: schema, invoicing, the client portal, PDF sections, and
   job costing (retainage is revenue recognised but not collected, which
   `compareJobCost` has no concept of).

---

## What I could not determine

- **Whether the change-order omission from job costing was a decision or an
  oversight.** `docs/CALLBACKS-AND-CHANGE-ORDERS.md` argues at length for not
  *deriving* change orders from quote/invoice edits, and it is convincing. It says
  nothing about why an explicitly logged `priceDelta` does not then flow into
  revenue. It may be deliberate (the doc notes a change order agreed today might
  not be invoiced until the final bill, so quote total and change orders "rarely
  move in lockstep"). Worth asking the owner before changing it.
- **Whether any of this is exercised in production.** I read code, not data. I
  did not run the build or any `check:*` script, and I have no row counts — so I
  cannot say whether any company has ever logged a change order, a service plan
  or an asset use. Per the standing memory note *"ask whether a route has a
  caller"*: I verified every screen and route here has a caller in code; I did not
  verify anyone has ever pressed the button.
- **Whether `JobVisit.status` values beyond `scheduled`/`on_the_way`/`completed`
  exist.** I read `VisitStatus.js` and its header but not `lib/jobs/visitStatus.js`
  in full, so the complete state set is unconfirmed. It does not change any verdict.
- **How complete `lib/marketing/competitors.js`'s capability map is as a
  substitute for this audit.** I cross-checked four of its rows and all four held,
  but I did not audit the other ~16.
- **Whether the 25 MB / PDF-only upload limits are policy or incidental.**
  `lib/media/validate.js:316` sets `MIGRATION_DOCUMENT_MAX_BYTES` to 25 MB "same
  ceiling as classifyMedia's documents"; whether that ceiling would survive
  construction drawings is a question for whoever scopes build #3.
