# FieldQuo — current phase and what's left

Last updated: 30 July 2026. **Update this file when you finish something.**

Read `AGENTS.md` first for the product goal and the non-negotiables.

---

## Where the product is

**Phase: feature-complete on the core pipeline, hardening and monetising.**

Lead → Quote → Job → Invoice → Payment works end to end. Quotes and invoices
are branded, translated, sendable, payable, and mirror each other. The website
builder, self-quote form, booking calendar and embeds all exist. What remains
is (a) one large unbuilt feature, (b) a few product decisions, and (c) the
hardening that turns "works when I try it" into "works for a stranger".

**The honest caveat:** this codebase was scaffolded quickly and has been swept
three times for controls that appear to work and don't. Assume there are more.
When you touch an area, check it rather than trusting it.

---

## ⚠️ Do these first — deployment is currently incomplete

**Moved to [VERCEL.md](VERCEL.md)** and kept honest there: `npm run check:env`
runs as part of the build and fails it if any `process.env.X` in the codebase
is missing from that page. This section used to be the list and had already
drifted — two of its five items were done, and it was missing every variable
added since.

Still outstanding at the time of writing: the Retell keys, both Stripe webhook
secrets, `GOOGLE_MAPS_SERVER_KEY`, `CRON_SECRET`, the two JWT secrets, the
`*.fieldquo.com` wildcard domain, three secrets to rotate, and the Resend DNS.

---

## Not built

### Unified inbox — blocked on external integrations, not started

Housecall's pitch is one thread list for leads from Google / Thumbtack / Angi
with a sub-60s auto-reply. The marketplace side needs OAuth + webhooks into
each, which can't be built or tested without the accounts — building it blind
would be an untested integration masquerading as a feature. What IS buildable:
one inbox over the lead sources FieldQuo already has (lead form, self-quote,
voice calls, bookings) with a speed-to-lead metric. Check whether `/app/leads`
already covers most of this first. Needs a product decision on which
marketplaces justify the integration cost.


### 1. AI phone agent / receptionist — foundation built, no UI yet

Provider is **Retell**, platform-owned: FieldQuo holds one account and
provisions an agent and a number per company, so a contractor never sees Retell.

Built and checked:
  * `lib/voice/retell.js` — the only file that talks to the vendor
  * `lib/voice/numbers.js` — buy / **forward** / port. Forwarding is the
    recommended default; read the header before changing that.
  * `lib/voice/credits.js` — prepaid, 35¢/min local and 40¢ toll-free, priced
    against Jobber's $0.79/conversation. Toll-free costs more BOTH ways.
  * `lib/voice/prompt.js` — the guardrails. Never a price, never an unchecked
    time, always admits to being an assistant.
  * `/api/voice/webhook` — signature-verified, bills once per call.

Also built since: the settings screen (`/app/settings/voice`), number
provisioning, Stripe top-ups, agent provisioning from the company's own data,
the tools (`save_caller` / `check_availability` / `book_visit`), and the call
review queue at `/app/receptionist` — which is no longer a placeholder.

**Still to do:**
  * A real call end to end, once `RETELL_API_KEY` and `RETELL_WEBHOOK_SECRET`
    are in Vercel. Everything below the provider boundary has been exercised
    with signed fixtures; nothing has yet spoken to Retell.
  * Porting is recorded as a REQUEST with an expected date and nothing actions
    it — a human has to. That's deliberate (a port needs carrier details no
    button can obtain) but it means somebody must watch for
    `VoicePhoneNumber.status = "porting"`.
  * Monthly number rental is stored on the row and not yet billed. Talk time
    bills correctly; the $4/$9 a month does not leave the database.

**What it should do:** answer inbound calls, capture the caller's details,
create a `Client` or `LeadRequest`, book a visit against real availability,
and optionally draft a quote — all reviewable by a human before anything goes
out.

**Shape that was outlined but not started:**

- Twilio Voice + Media Streams, or a managed provider (Vapi, Retell) to avoid
  building turn-taking and barge-in from scratch. Twilio is already a
  dependency for SMS.
- Tools the agent may call **freely**: create `Client`, `LeadRequest`,
  `Booking`. Tools it may call **as draft only**: `Quote`.
- **The agent never sends anything and never quotes a price out loud.** A price
  a contractor hasn't seen is one they may have to honour.
- Attribute writes to a synthetic `Member` so the audit log shows the agent,
  not a person who wasn't there.
- A review queue with the call recording attached. RBAC-gated approval before
  a drafted quote can be sent.

Start by asking the owner to confirm the provider choice — managed vs raw
Twilio is a large, hard-to-reverse decision.

### 2. Directory — needs a product decision before any code

"Help clients find my business" (`Company.discoverable`) exists as a column.
Three different products could sit behind it, and they aren't compatible:

- a public listing page FieldQuo hosts and ranks;
- structured data only, making each tenant site rank on its own;
- a feed for AI assistants to answer "who does kitchen respraying near me".

Ask which one before building. Don't ship the toggle until one exists.

### 3. Website hosting: billing and entitlement

The website builder works and is currently free and ungated. The owner's
stated direction:

- one free month during trial;
- then a low monthly fee, anchored on shared hosting (~$2.99 / ~$4.99 CAD);
- **no custom domains** — deliberately out of scope, subdomains only;
- a one-off site-creation fee was floated at "token cost × 5".

**Two things to raise before implementing:**

- Generation costs **~3¢** (mid-tier model). ×5 is ~15¢ — below the cost of
  metering it, and charging per generation discourages regenerating, which is
  what makes the site good. It is already metered via `checkAiQuota`.
- At $2.99 CAD, Stripe's 2.9% + $0.30 is **13% of revenue**. Adding it as a
  line item on the company's existing FieldQuo subscription — rather than a
  second charge — removes the fee and avoids having to answer "their card
  failed, does the live website go down?"

Whatever is chosen: publishing must be gated on the entitlement, and a lapsed
subscription should unpublish (404) rather than delete. The content survives.

### 4. ISR on tenant websites

`app/site/[subdomain]/page.js` is `force-dynamic`, so **every visit is a
function invocation plus a database query**. That is the actual hosting cost,
and the actual answer to "what if a site gets a lot of traffic". Switching to
`revalidate` takes it to near zero.

Interacts with the `?preview=1` draft mode added for the editor — the preview
path must stay dynamic while the public path caches.

### 5. Found by audit — not yet done

- **`ForecastSettings` has 13 columns and 1 consumer.** `jobsPerWeekCapacity` is
  now settable on `/app/settings/overhead` and drives the minimum-price figure
  there. The other twelve (conversion rates, curve coefficients, smoothing
  alpha) are written by nothing and read by nothing. Annotated in the schema —
  do not put them on a form until something reads them.
- **`Testimonial.featured` is a sort key nothing can set**, so ordering by
  "featured" is inert. Either add the toggle where testimonials are managed or
  drop the `orderBy` in `/api/settings/website`.
- **Redundant boolean state**: `Quote.clientDesignSaved` (use `clientDesignAt`)
  and `PamphletStop.spokeToOwner` (use `status === "spoke"`). Both written, never
  read, able to disagree with the field that is read.
- **Three pay-rate paths disagree.** `AddEmployeeModal` → `quick-add` writes
  `Worker.hourlyRate` (payroll reads it). The New User page → `/api/settings/members`
  writes `Member.laborCostPerHour` and no Worker at all. `/settings/overhead` →
  `/api/salaries` writes `Salary` rows with `workerId: null`, and `buildPayRun`
  reads salaries PER WORKER — so an overhead salary never reaches a payslip. The
  overhead page now says so; the two settings paths should converge.
- **Payroll/HR still to build**: payslip translations, shift management beyond
  `WorkingHours`, expense-claim approval workflow, employee lifecycle,
  appraisals, loans/advances, year-end forms (T4/W-2/P60), geolocation on
  check-in.

### 5b. Kitchen designer — built, two pieces left

Adapted from the owner's working TrueFinish code. What's done:

- `lib/kitchen/pricing.js` — the maths unchanged (it prices kitchens real
  clients bought; `npm run check:kitchen` pins it to those numbers), but rates
  now belong to the company (`Company.cabinetRates`), line items come out in
  FieldQuo's shape, and nothing trusts its input.
- `lib/kitchen/geometry.js` — ONE wall-to-XY mapping, shared by the editor and
  the drawing. Do not copy it into a renderer; that is how the picture a client
  approves stops matching the one the crew builds from.
- `lib/kitchen/planShapes.js` + `PlanSvg.js` — the presentation plan.
- `/app/quotes/[id]/kitchen`, `/design/[token]`, `/app/settings/cabinet-rates`.

Elevations, the finish picker, the self-quote entry and the PDF are all done —
the drawing on a quote comes from the same `planShapes` list as the screen, via
`lib/kitchen/PlanPdf.jsx`. Do NOT add a third renderer or re-derive the geometry:
a client approves a drawing on their phone and signs a PDF, and two code paths
drift invisibly until a crew builds from the wrong one.

**Still to do:**

1. **Mobile drag.** Snapping exists (2", `SNAP` in geometry.js) and `findGaps()`
   flags holes above it, but neither has been tried with a thumb on a real
   phone. The one thing left here that can only be checked by hand.
2. **Trade calculators — DONE (all four).** Every supplied calculator is now a
   self-serve instant-quote trade in `INSTANT_ESTIMATE_TRADES`, with
   company-editable rates on `/app/settings/instant-quotes` and the price
   computed server-side (never a hardcoded shop rate; browser sends the material
   key + measurements, per #5):
   - **Countertop** — installed $/sqft per material + additive edge/cutout/
     backsplash extras (`manual_area`). `check:countertop`, 21 assertions.
   - **Flooring** & **Painting** — area × material + percentage surcharges,
     reusing `estimateAreaTrade` (`manual_area`). `check:area-trades`, 16.
   - **Stair** — priced per tread by complexity + railing per ft; the old
     `{ standard: 110, moderate: 145, high: 180 }` constant is now company
     material rates (`ratePerTread`, new `stair_count` measure). `check:stair`, 14.

   `materialRateKey(trade)` (settings API) is the one source of truth for which
   per-material key a trade sells on (square / tread / sqft), so the editor and
   the "is it priceable?" guard can't drift. Remaining calculator nicety: feed
   the kitchen designer's countertop module into the Countertop trade (optional).

Two rules this feature already depends on. The client designer is PUBLIC, so it
returns no prices — `stripPricing` rebuilds the payload key-by-key rather than
deleting known fields, because a blacklist starts leaking the moment the pricing
engine gains one. And it accepts no prices: `mergeClientDesign` re-attaches
appliance pricing from the contractor's own copy, verified against the live
endpoint with a tampered POST.

### 6. Smaller open items

- **App interface language: shell and main screens done, ~65 screens to go.**
  `User.language` is read now — `app/app/layout.js` resolves it (personal choice,
  else company default) and feeds a nested `LanguageProvider`. Both sidebars, the
  dashboard and the Quotes/Jobs/Invoices/Clients screens are extracted into
  `app/i18n/appMessages.js` (187 strings, English + French). The rest of
  `/app` is still hardcoded English and falls back cleanly.

  Two rules for continuing it. **English and French only** — machine-translating
  hundreds of interface strings with nobody to check them puts unreviewed text
  on payroll and invoicing screens; adding a language means filling in a whole
  object and nothing else. And **the app must keep saying where it stands**: the
  language settings page prints real per-language coverage from `appCoverage()`,
  so a picker offering six languages can't imply an interface that isn't there.
  `npm run check:translations` reports coverage both ways and fails on a key the
  code references but the catalogue doesn't define.
- `app/(marketing)` is **partly** extracted, not untouched as this line used to
  claim: the shared components (header, hero, FAQ, footer, pricing card) all use
  `t()` and are complete in six languages. The marketing PAGES — pricing, about,
  careers, contact, terms, privacy, resources — are still hardcoded English.
- `getConversionRate` returns a single period, but marketing copy promises
  "up from 31% last month". Either compute the prior period or change the copy.
- The gallery block ships empty by design (no stock photos). Consider pulling
  job photos from completed jobs as suggestions — the data is there.

---

## Recently completed (for context on conventions)

Newest first. Read the code in these areas before writing anything similar —
they set the pattern.

- **Contractor-to-contractor quotes (GC ↔ subcontractor)** (`QuoteImport`
  model, `lib/quotes/importedStatus.js`, `lib/quotes/importQuote.js`,
  `/api/quotes/received/[token]`, `/api/quotes/[id]/imports`,
  `ContractorImportPanel`, `ImportedByPanel`, `ImportedCostsPanel`). A GC who
  receives a sub's quote in FieldQuo pulls it into their own quote as a
  marked-up cost line; the sub is paid the original price. **Commit status is
  DERIVED** from the GC quote's stage (draft/sent = pending; accepted/job/invoice
  = confirmed; declined = cancelled) — never stored. One linkage row, two
  role-scoped projections: the importer sees cost + markup + client price, the
  source sees only that they were imported and the status (never the GC's
  margin). White-label preserved: the panel self-hides for individual clients
  (homeowners) and shows only for business recipients / logged-in contractors.
  `/login?next=` brings a signing-in contractor back to import.
  - **Deferred, on purpose:** (1) the subcontractor snapshot cost isn't yet
    materialised as a Job `Expense`, so it doesn't flow into job-costing/margin
    analytics — it's read on the GC's quote but not in costing. (2) Deleting the
    auto-created "Subcontractors" scope group via the normal quote *editor*
    (rather than the panel's Remove button) would leave a dangling `QuoteImport`
    row — the editor save path doesn't yet reconcile imports. Sanctioned removal
    is the Remove button. (3) Signup→import auto-return isn't wired (signup ends
    at Stripe checkout); the copy honestly says "reopen the link".

- **Client media on every quote — photos AND video** (`lib/media/validate.js`,
  `MediaUploader`, `/api/self-quote/[companySlug]/upload`). One validator is the
  boundary for both the authenticated `/api/upload` (now accepts video) and the
  public anonymous upload — a limit in one and not the other is the hole a 2 GB
  file drives through. A homeowner can attach a photo/short clip on both public
  self-quote surfaces (`/instant-quote/*` and `/quote/*`); it's stored on
  `Quote.clientPhotos` / `LeadRequest.clientPhotos` (normalised https-only,
  count-capped) and shown back to staff on the quote detail and the leads board.
  **Two follow-ups**: (1) `LeadRequest.clientPhotos` is a NEW column — run
  `npx prisma db push` before the leads media renders in prod; (2) the public
  upload endpoint has no IP rate limit yet (bounded by real-slug + per-file
  validator), so add one before it's heavily embedded.
- **Junk removal is a full self-serve instant-quote trade** (`lib/junk/pricing.js`,
  `lib/junk/guidance.js`, wired through `lib/estimate/instantEstimate.js` +
  `instantQuoteServer.js`). Volume-based pricing (per-item price DROPS with load
  — the whole model), special-recycling fees (freon/e-waste/mattress/tire),
  access surcharges, hazards priced at nothing but warned. Now end-to-end:
  a new `item_picker` measure type (pick items + quantities + job type + access,
  browser sends keys only, server reprices per #5); a junk rate-card editor on
  `/app/settings/instant-quotes` (dollars in the form, cents in storage); the
  homeowner's picked items are preserved on the draft for the reviewer. Plus
  default company-editable content: a customer FAQ + a new-operator
  pricing/process guide, written original (not copied). 18 + 15 + 45 assertions.
  While here, fixed a pre-existing DEAD CONTROL on that settings page: the
  "What the homeowner sees" radio called an undefined `update()` and threw on
  click — now `patch()`.
- **Job-photo gallery** (`lib/gallery/`, `/api/jobs/[id]/photos`, JobPhotoCurator)
  — crew photos file as JobPhoto rows with an inferred STAGE (start/progress/
  finish/issue); the owner stars the good ones; the website shows featured
  photos and builds before/after from featured start+finish. Read the stages/
  albums headers: nothing unfeatured or "issue" is ever public, and a before/
  after needs BOTH sides. Featured is authoritative on the site; an uncurated
  gallery still auto-fills from the raw feed.
- **Payroll rate fallback** (`effectiveWageRate` in `buildPayRun.js`) — a rate
  set via the members screen (Member.laborCostPerHour) now reaches the payslip;
  it used to show $0 because payroll read only Worker.hourlyRate. Read-side, so
  it never clobbers an explicit rate, and overhead salaries (workerId:null) stay
  business costs, not pay — that part was never a bug.
- **Self-quote estimate email** (`lib/estimate/estimateEmail.js`) — white-label,
  built from documentTheme so it matches a real quote; gated trades show no
  figure, financing shows no invented monthly amount.

- **Honest month-over-month** (`lib/analytics/trend.js`) — `getAnalyticsOverview`
  now computes `priorConversionRate` (null, not zero, when last month had no
  activity). `compare` / `describeRateTrend` return null rather than a fabricated
  baseline, so the digest states "up from X%" only when X is real. Every AI
  surface is already told never to invent a number.

- **Outbound call triggers complete** (`lib/voice/triggers.js`) — all three
  purposes now fire: quote approved, visit booked (day-before reminder), and a
  new lead ("someone will call you shortly"). The booking route now records a
  `booking` consent row (it didn't before). Pure timing in `reminderTiming` /
  `describeAppointmentTime`, tested.

- **Crew messaging agent** (`lib/crew/`, `/api/crew/inbound`, `/app/crew-inbox`)
  — crew text photos/updates to the company number; it files each to the right
  job. TWO pure cores, exhaustively tested (61 assertions): `attribution.js`
  ("which job?" — never guesses silently, asks with tappable candidates) and
  `inboxLogic.js` ("file / ask / resolve a reply"). `inbox.js` is the thin DB
  adapter; the Twilio webhook verifies the signature and no-ops for any company
  that hasn't switched it on. Read the attribution header before touching:
  explicit text > GPS (only when clearly nearest) > only-one > ask, and the
  cost asymmetry (a five-second reply beats a silent wrong file) is the whole
  design. FieldQuo's edge over Barry: owns the schema (no OAuth/approval gate)
  and already geocodes job addresses for the GPS tier.

- **Retell OUTBOUND** (`lib/voice/outboundCall.js`, `outboundPrompt.js`,
  `/api/cron/voice-outbound`) — a queue drained by cron, every gate re-checked
  at dial time. Read `outboundPrompt.js` before touching: it discloses up front
  and honours "stop calling", and may state a quote total a human approved but
  never compute one. Trigger: approving an instant estimate, behind
  `Company.outboundCallsEnabled`.
- **Revenue goal + pace** (`lib/analytics/goal.js`) — one annual number, all
  targets derived. The headline is ahead/behind pace, because a raw % is
  meaningless without the date. On the dashboard.
- **Editable client messages** (`lib/sms/renderTemplate.js`, Settings → Client
  messages) — token WHITELIST, invalid templates fall back to the built-in so a
  bad edit can't ship "{price}". Only on_my_way is editable because it's the
  only SMS actually wired to send; the registry knows the others but won't offer
  them until they send.

- **Demo accounts** (`lib/demo/`, `/platform/demo`, `npm run seed:demos`) — ten
  sales demos with a switchable trade. Read the `assertDemo` note before
  touching: every write RE-READS the company and refuses anything without
  `isDemo`, because switching trade wipes quotes, jobs and clients. No logins
  are created — invitation only, per non-negotiable 1.
- **The tour works on phones** (`app/components/OnboardingTour.js`) — every
  lookup goes through `visibleTarget()`, because `hidden lg:flex` is
  display:none rather than unmounted, so the desktop sidebar matches every
  `data-tour` selector with a {0,0,0,0} rect. Steps declare `openWith` /
  `closeWith` to reach targets behind a drawer.

- **Travel time between jobs** (`lib/booking/travel.js`) — the booking page
  collects a visit address and hides slots the estimator can't drive to, both
  legs. The file imports NOTHING, so its pure half runs in the browser for the
  appointments list and on the server for slot filtering. Read the header
  before touching it: unknown travel must never hide a slot, and an earlier
  version returned null past 300 km, which meant Montreal-5pm to Toronto-6pm
  was the one case that sailed through. Settings on Settings → Booking page.
- **Arrival windows** (`lib/booking/arrivalWindow.js`) — client-facing only, off
  by default. `describeWindow` returns null when off so callers fall through to
  their own exact-time formatting instead of duplicating it.
- **`docs/VERCEL.md`** — the deployment checklist, and `npm run check:env` fails
  the build if any `process.env.X` in the codebase is missing from it. Add the
  SYMPTOM, not just the name.

- **Automatic review requests** (`lib/reviews/`, `/api/cron/review-requests`,
  hourly) — asks a customer once, ever, after their job is finished. The
  decision lives in `request.js` and touches nothing, so the rules that cost
  money when they leak are executable against hostile input; the cron claims
  `Job.reviewRequestedAt` with a conditional update BEFORE sending, so
  overlapping runs can't double-ask. Note `sendEmail` returns
  `{ id | error | skipped }` rather than throwing — `skipped` releases the
  claim, `error` keeps it. Settings at `/app/settings/reviews`, which shows a
  live queue count so the toggle can't quietly be a lie.
- **`Job.completedAt`** — stamped on the first flip to completed, cleared on
  reopen. The follow-up cron used `updatedAt` as a proxy and carried a comment
  saying so; renaming a job re-armed every follow-up on it. One write site
  (`/api/jobs/[id]` PATCH), so it can't be bypassed.

- **Website generation is composition-driven** — the reason every generated site
  used to look identical was not the prompt. `siteFromCompany()` returned one
  hardcoded list of ten blocks in one hardcoded order and `merge()` mapped over
  it, so the section set and order were unreachable from anything a company
  typed. Now:
  - `lib/site/composition.js` — the model returns an ordered list of section keys
    from a closed vocabulary; `validateComposition` clamps it (unknown names
    dropped, hero first, contact last, cta may repeat but never twice running,
    and any section the company has no DATA for is refused). Five hand-designed
    page shapes; the no-AI path picks one from the company's own data so it
    varies too.
  - Hero 6 variants, services 5, plus variants on about/gallery/testimonials.
    Seven design systems that move header behaviour, accent usage, shape
    language, heading alignment and section rhythm — not five tokens.
  - New sections: before/after slider, process, areas-served, CTA band.
  - `app/site/[subdomain]/BeforeAfter.js` — draggable comparison. Reveal is
    clip-path (no DOM measurement, so no hydration mismatch and it reflows for
    free); the control is an invisible range input so keyboard, touch and screen
    readers work; the AFTER image is a plain `<img>` so JS-off shows finished
    work. Pairs come from JobVisit visits with EXACTLY two photos — nothing in
    the schema flags before vs after, and a page calling a finished kitchen the
    "before" is worse than no slider.
  - **Live data, not snapshots**: services reconcile against currently-enabled
    categories every request (list from the DB, blurbs from the block), an empty
    gallery fills from job photos, an empty slider from two-photo visits,
    WorkArea rows drive areas-served. Enable a trade and the public page
    advertises it without regenerating.
  - **`html { @apply font-serif }` with `--font-serif: var(--font-serif)`** — a
    variable defined as itself, resolving to nothing. The entire back office and
    every tenant website rendered in Times New Roman while Geist sat loaded and
    unused. Fixed; `serif` is now a deliberate choice two styles make.

- **Mobile** — 35 of 72 `/app` pages had zero breakpoints. The worst was one
  line: `settings/layout.js` kept `SettingsSidebar` at `w-64 shrink-0` at every
  width, leaving 119px of a 375px phone for ~28 settings screens. Both sidebars
  now have mobile drawers, `AdminSidebar`'s floating hamburger became a sticky
  `h-14` bar (it used to sit on top of every page's `<h1>`), quote and invoice
  line items stack via `sm:contents`, the schedule week scrolls sideways, and 55
  page roots went from a fixed `p-6` to `p-4 sm:p-6`. Verified in a browser at
  375px and 1280px.

- **Payroll + leave/PTO (HR foundation)** — FieldQuo *calculates and records*
  pay; the company pays through its own bank or provider. Nothing here moves
  money and no button claims to.
  - `lib/payroll/computePayRun.js` — pure engine: overtime split per period,
    progressive tax from configurable slabs (Frappe HR's "income tax slab"
    shape: annualise → tax by band → divide back), percent and fixed
    components, net clamped at zero with an `overDeducted` flag.
  - `lib/payroll/statutoryTemplates.js` — CA/US/UK starter sets, each carrying
    `sourceYear` and an explicit list of what it does NOT model (provincial and
    state tax, employer contributions, CPP2, allowance tapering, NI category
    letters). Seeded, then edited by the company.
  - `/app/settings/payroll` — the salary-component library, without which net
    pay is impossible.
  - `lib/leave/accrual.js` + `lib/leave/balances.js` — three accrual methods
    (fixed annual, per pay period, percent-of-gross for the Canadian 4%
    model), carryover with null ≠ 0, year-end roll as an explicit action.
    Remaining is always derived, never stored.
  - `/app/time-off` (own balances + requests, manager approval, team view) and
    `/app/settings/leave` (policies, regional templates).
  - **Paid leave flows into payroll** as a named earning priced at days × that
    person's own hours-per-working-day × rate — a four-day-ten-hour crew loses
    10 hours a day off, not 8. Salaried people aren't re-priced (they'd be paid
    twice).
  - **Approved leave removes the day from booking** (`computeAvailability`), so
    a homeowner can't book someone who's away. A half day blocks the whole day:
    the request doesn't record *which* half, and guessing costs a missed
    appointment.
  - **Two real bugs found and fixed by back-testing, worth knowing about:**
    (a) accrual pro-rated everyone as a new hire from `Worker.createdAt`, which
    for a backfilled row is *today* — so a five-year employee got ~4% of their
    holiday. There is now a real `Worker.hiredOn`, nullable, and no hire date
    means the FULL allotment rather than a guessed fraction.
    (b) mid-year pro-rating grew week by week, so nobody's entitlement was
    knowable until December. It's now measured from start date to year end and
    is constant.
  - **`Worker` rows are now created on invitation acceptance**
    (`lib/team/ensureWorker.js`), with a self-healing backfill on the members
    list. Before this, accepting an invite created only a `Member`: the person
    could sign in but had no presence on the books — no timesheets, no payslip,
    no leave — and nothing on screen said so. Not one company in the database
    had a linked worker.
  - `/app/settings/team/workers` is now **editable** (pay rate, start date,
    active). It previously displayed a rate that nothing in the app could set,
    which meant payroll warned on every line.

  Still open here: payslip PDF/CSV export, shift management beyond
  `WorkingHours`, expense-claim approval workflow, employee lifecycle
  (onboarding/offboarding, promotions), appraisals, loans/advances, year-end
  forms (T4/W-2/P60), geolocation on attendance check-in.

- **Instant estimator (Cossette-style)** — public "get an instant estimate"
  flow. Address → Google Solar buildingInsights (roof area + predominant pitch,
  sloped area used directly) → per-material price RANGE + satellite still; lawn
  via a traced polygon (server recomputes the area); epoxy/parging/cabinet via
  typed intake. All money is recomputed server-side from the company's own
  saved rates (`InstantQuoteConfig`) — a trade with no config isn't offered, so
  no invented price is ever published. Estimates land as `draft` quotes with
  `needsReview=true`; **send AND share are gated** until someone with
  `quote:approve-estimate` signs off in `/app/estimate-reviews`. Pieces:
  `lib/measure/` (measurement, live-tested + hostile-input tested),
  `lib/estimate/` (pure pricing brain, reproduces real Cossette figures),
  `/api/instant-quote/*`, `/app/settings/instant-quotes`, `/app/estimate-reviews`.
  Two new service categories seeded: `epoxy`, `parging`.
  **To go live in production:** add `GOOGLE_MAPS_SERVER_KEY` (or confirm the
  existing `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is unrestricted enough for
  server-side Solar/Geocoding — a referrer-restricted key rejects server calls)
  with Geocoding + Solar + Static Maps enabled, and have each company set their
  rates + enable trades. Consider linking `/instant-quote/<slug>` from the
  "Share your links" settings page and the website builder.
- **Website blocks integrated with real company data** — opening hours block,
  booking calendar and self-quote form embedded inline, all rendering from the
  company record rather than retyped text. Booking and hours blocks only appear
  when the underlying feature is configured.
- **Layout variants** — 3 hero, 3 services. The model picks from a closed set
  and is told whether a photo exists. This, not a bigger model, is the lever
  for a page that looks modern.
- **Embeddable widgets** — `/embed/<slug>/<book|quote>` with iframe height
  reporting, for the majority of contractors who already have a website and
  won't adopt the site builder.
- **Website builder + subdomains** — `CompanySite`, rewrite in middleware,
  block renderer, AI draft from a 5-question interview, publish/unpublish.
- **Client language drives all communication** — not just the PDF.
  6 languages × 22 email keys, as functions rather than strings because word
  order differs.
- **Invoices fully mirror quotes** — same sections, same theme, same emails.
- **Branded document theme** — every colour derived from one brand hex,
  contrast measured at 4.5:1 across hostile inputs.
- **AI quote review + upsell add-ons** — completeness checks plus the company's
  *own* accepted/declined history, never cross-tenant. Repricing is
  server-side; the browser sends IDs only.
- **Quote builder rebuilt** into nine components (1,500 → 723 lines).
- **Platform health checks** — `/api/platform/email-health` and
  `/api/platform/ai-health`, both surfacing as dashboard banners. They exist
  because both failures are invisible from inside any tenant account and
  affect every tenant at once.

---

## Suggested first session

1. Read `AGENTS.md`.
2. `npm run build` — confirm it's green before changing anything.
3. Work the ⚠️ list above; most of it is deployment, not code.
4. Pick up §3 (hosting billing) or §4 (ISR) — both are small and unblock
   revenue — or ask the owner to greenlight §1 (phone agent), which is the
   largest remaining feature and needs a provider decision first.
