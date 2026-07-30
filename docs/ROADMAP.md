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

These block or degrade features that are already merged.

1. **`npx prisma db push`** — `CompanySite` and `Company.businessHours` are in
   the schema and may not be in the database. Retry once on `P1001` (Neon
   scale-to-zero).
2. **Add `*.fieldquo.com` as a wildcard domain in Vercel.** Until this exists,
   no tenant subdomain resolves at all. The code is ready; the DNS isn't.
   Locally, `sunset.localhost:3000` works with no setup.
3. **Check the AI model.** Deploy, then open `/platform` — an amber banner
   appears if the configured model is retired. `lib/ai/provider.js` defaults to
   `gpt-5-mini`, which OpenAI has superseded. If the banner fires, set the
   working model as the *code default* (not an env var — it isn't a secret) and
   delete the commented `OPENAI_MODEL` line in `.env`.
   Symptom if ignored: every AI feature returns nothing, silently, with no
   error in any log, because `provider.js` catches and degrades.
4. **Rotate three secrets.** They were pasted into a chat transcript:
   Cloudinary API secret, the Neon database password, `BETTER_AUTH_SECRET`.
5. **Finish the Resend DNS** for `fieldquo.com` if not already done: TXT at
   `resend._domainkey` with Resend's key; delete the stale record under
   `privateemail._domainkey`; root SPF must be
   `v=spf1 include:spf.privateemail.com ~all` (one SPF record per host — a
   second breaks both).

---

## Not built

### 1. AI phone agent / receptionist — the big one

`app/app/receptionist/page.js` is an honest "coming soon" placeholder. The nav
links to it. Nothing else exists.

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

### 6. Smaller open items

- `app/(marketing)` copy is still hardcoded English. The i18n catalog exists;
  the marketing site was never extracted into keys.
- `getConversionRate` returns a single period, but marketing copy promises
  "up from 31% last month". Either compute the prior period or change the copy.
- The gallery block ships empty by design (no stock photos). Consider pulling
  job photos from completed jobs as suggestions — the data is there.

---

## Recently completed (for context on conventions)

Newest first. Read the code in these areas before writing anything similar —
they set the pattern.

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
