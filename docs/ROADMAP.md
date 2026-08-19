# FieldQuo — current phase and what's left

Last updated: 9 August 2026. **Update this file when you finish something.**

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


### 1. AI phone agent / receptionist — built, first live test done

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

**Found in the first live test, and fixed:** every number bought or forwarded
was written on the schema default `status = provisioning`, and nothing anywhere
promoted it to `active`. Every reader filters on `active` — `activeNumber()`,
the settings GET, the crew-inbox webhook, outbound dialling, agent attachment,
the rent cron — so a number that had been bought at Retell and charged a
month's rental was invisible to all of them. The setup screen came back
unchanged, the duplicate guard read the same column and found nothing, and a
second click bought a second live number. The route now writes `active`
explicitly; `heldNumber()` in `lib/voice/numbers.js` is the wider query that
sees stranded rows so the guard and the screen can't be blind to them again.
**Rows created before this fix are still stranded in production and need a
manual `status` repair — they are live numbers accruing rent that their owner
cannot see.**

Also fixed alongside it: the setup buttons said nothing at all on success; the
two call switches were disabled with no reason (the reason is now computed
server-side by the same `checkSpend()` the PUT gate runs and printed under the
button); the port card promised an email nothing sends; and the crew inbox
could be switched on against a number no text could reach.

**Still to do:**
  * **A port request reaches no one.** It writes a `VoicePhoneNumber` row and an
    `ActivityLog` entry — both inside the company's own account. The platform
    console reads `PlatformAuditLog`, a different table, and no email is sent.
    So "a human has to action it" is currently "a human would have to already
    know". It needs an ops queue or a notification before porting is offered as
    a real option. A contractor can now at least *cancel* a request (DELETE on
    `/api/settings/voice/number`, porting rows only — no provider call, no
    money), which was the immediate problem: a port row matched the duplicate
    guard, so every other setup path returned 409 and there was no way out.
  * **The crew inbox has no wired inbound path.** `/api/crew/inbound` is a
    Twilio SMS webhook, but numbers are bought from **Retell**, so they are not
    in FieldQuo's Twilio account and Twilio will never post a text about them.
    Nothing in the codebase configures an incoming number's SMS URL. Until that
    is resolved the switch opens a door with no road to it. (It is also purely
    inbound — enabling it sends nobody anything, which the screen now says.)
  * A real call end to end, once `RETELL_API_KEY` and `RETELL_WEBHOOK_SECRET`
    are in Vercel. Everything below the provider boundary has been exercised
    with signed fixtures; nothing has yet spoken to Retell.
  * ~~Monthly number rental is stored on the row and not yet billed.~~ **Done.**
    The rental now debits the prepaid balance: the first month is reserved
    BEFORE the number is bought (`lib/voice/spendGate.js`), and
    `/api/cron/voice-rent` takes each month after against
    `VoicePhoneNumber.rentPaidThroughAt`. Unpaid means a warning, a 7-day grace
    period in which the number keeps working, then release — never a silent
    disappearance. Every path that costs FieldQuo money goes through the one
    gate; `npm run check:voice-spend` fails if a second one appears.
  * Concurrency is NOT gated. The one Retell account has a shared
    simultaneous-call ceiling (`/get-concurrency`), so one tenant's busy Monday
    can make another's phone stop answering. Same class as the spend gate, but a
    capacity limit rather than a money one — see the header of `spendGate.js`
    for where it would go.
  * SMS is not metered at all. Twilio bills FieldQuo per message for appointment
    reminders, visit notifications and the crew inbox, and nothing charges for
    it. Same shape as the rental leak was; it needs a price per message first,
    which is a product decision.
  * There is still no way for a contractor to RELEASE a LIVE number. Only the
    rent-expiry path releases anything. The screen no longer leaves this
    unanswered — a forwarded setup says "dial `##002#`", a bought one says to
    get in touch and that releasing is permanent — but the self-serve control
    needs a product decision first: releasing is an irreversible provider DELETE
    and nobody has said what happens to the month already paid.

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

## 7. The labour layer — sequencing matters more than the code

From `docs/estimating-standards-and-licensing.md` §5–6. Three layers, different
confidence and different legal footing; conflating them ships a control that
appears to work.

**7a. `TimeEntry` has no task dimension, and this blocks everything below it.**
The model is `{workerId, jobId, clockIn, clockOut, hours}`, read only by payroll
and the time clock. So a company can learn "this job took 40 hours" and can
**never** learn "we take 0.93 h per opening". `JobVisit.checklistItems` is
free-form JSON, which is the closest thing to a task taxonomy we have.

This is the **longest-lead, lowest-visibility** item in the whole roadmap: the
data has to be captured against a structured task taxonomy *before* it
accumulates, or a year of actuals is worthless. It should be done before the
labour seeds, not after. The catalogue keys in `app/data/*Catalog.js` are the
natural taxonomy — join to those rather than inventing a second one.

**7b. Seed hours thinly and mark the seeds honestly.** In preference order:
licence Craftsman (see below) → run a structured time-study with 10–20 design
partners → **ship no seed at all** and require the contractor to enter their own
hour before a task is usable. All three are honest; the third also bootstraps 7a.

**7c. Let actuals displace the seeds.** `contractor_factor` starts at 1.0 and
shrinks toward the tenant's observed ratio as *n* grows, pooled at task-*family*
level so it's useful after 20 jobs rather than 2,000. **Show provenance in the
UI** — *Seeded — industry default* vs *Your average over 14 jobs* vs *Your
average, 3 jobs — low confidence*. Absence of a contractor's data is not a
statement about their speed. **Never cross tenants** (non-negotiable #8).

**Owner action, gates 7b: contact Craftsman Book Company** (ben@costbook.com).
They run a formal data-licensing programme for software developers — the only
labour-unit publisher found that does. NECA is a single-individual licence;
Gordian/RSMeans explicitly forbids building competing products from their data.
Confirm SaaS embedding, per-tenant display, derivative rights, and whether
Canadian area factors exist.

**Do not** scrape or transcribe NECA, RSMeans, Hanscomb, Trade Service or any
flat-rate book — and do not let a model launder them either. Constrain AI to
reasoning over our own tables, the way `lib/site/generateSite.js` already does.

---

## Recently completed (for context on conventions)

Newest first. Read the code in these areas before writing anything similar —
they set the pattern.

- **Three small settings jobs: share a referral by text, changelog posts, and a
  back link that tells the truth.**

  *Refer & Earn* now hands the invite to the user's own messaging app.
  `lib/share/messagingLinks.js` is the only place that knows `sms:` needs `&`
  on iOS and `?` on Android, and it is the only UA sniff in the flow — whether
  the button appears at all is a media query (`hover: none` + `pointer:
  coarse`), read through `useMessagingCapability()` so there is no
  setState-in-effect flicker. On a desktop the Text button is absent rather
  than dead; WhatsApp stays, because `wa.me` genuinely works there. The body is
  URL-encoded (an unencoded referral URL truncates the message at its first
  `&`) and now comes from the message catalogue instead of a hardcoded English
  string. `npm run check:share` runs the maths.

  *Product Updates* entries can carry an optional `slug` + `post` and render at
  `/app/settings/product-updates/<slug>`. Still a data file, not a model — see
  the header of `lib/data/productUpdates.js`. The "Read the full update" link
  renders from `hasPost()`, so an entry can't advertise a post nobody wrote;
  `npm run check:updates` enforces the pairing, slug uniqueness and ordering.

  *Drill-down back bar* (`app/components/settings/SettingsDrillDown.js`,
  mounted by the settings layout). Settings pages are siblings, not a tree, so
  a fixed parent link would lie on every visit that started from the sidebar.
  The bar needs both a claim from the link that was clicked AND a matching
  pathname transition; `resolveArrival()` in `lib/settings/drillDown.js` is the
  whole decision and `npm run check:drilldown` walks every way in. Currently
  claimed by one link: Company Settings → "Manage" → Services. The prose link
  to Website settings in the same card is still a plain `<Link>`.

- **Inviting an employee actually invites them** (`lib/email/teamInvite.js`).
  Reported after an onboarding test: the employee never got an email, while
  referral mail from the same Resend account arrived fine. The invitation was
  the last send in the product that didn't RESOLVE its sender — it let
  `sendEmail` fall back to `EMAIL_FROM || onboarding@resend.dev`, and
  `EMAIL_FROM` isn't set, so every invite was posted from Resend's sandbox
  address, which only delivers to the account owner. A refused send is an API
  error, not an email, so nothing appeared in the Resend dashboard either.
  Invites now go through `getPlatformFrom()` like the rest of the platform's
  mail.

  The second half was that the failure couldn't be reported: Better Auth calls
  `sendInvitationEmail` through `runInBackgroundOrAwait`, which swallows what
  the hook throws, and `sendEmail` returns errors rather than throwing — so
  both invite routes answered 201 "sent". They now collect the outcome
  (`takeInviteEmailOutcome`) and return `emailSent` / `emailError`; the popup
  and the New User page say so instead of closing cheerfully.

  Alongside it, on the same card: pending invites now count toward the
  onboarding "Invite your team" step (a Member row only exists after
  acceptance, so the count never moved), the step completes at one teammate
  instead of requiring every licence on the plan to be spent, and its link
  points at `/app/settings/team` rather than `/app/team`, which 404s. The
  popup uses the same address autocomplete and the same permission presets as
  the full form. Pending invites can be cancelled
  (`DELETE /api/settings/members/pending/[id]`) — and the accept route now
  refuses cancelled and expired invitations, which it didn't, so revoking one
  is real rather than cosmetic.

  **Still open:** `checkUserLimit` counts only active Members, while the Team
  page, the New User page and now the onboarding card all count a pending
  invite as a seat in use. Whether an unaccepted invite consumes a paid licence
  is a product decision, so enforcement was left alone. Also
  `invitationLanguage` is captured on the New User page and reconciled onto
  `Member`, but nothing reads it — the invitation email is English-only.

- **One quote lifecycle, both doors** (`lib/quotes/quoteLifecycle.js`). A quote
  accepted through the public link created a Job, a draft Invoice and a
  "schedule it" Task; the identical acceptance recorded in the back office
  (`PATCH /api/quotes/[id]`, which is what "They approved" on
  `/app/quote-approval` posts) created none of them. An acceptance taken over
  the phone was a dead end. `onQuoteAccepted` / `onQuoteDeclined` /
  `onQuoteSent` are now shared by both routes and by the send route.

  The same helper moves the originating lead: sent → `contacted`, accepted →
  `converted` (the value the board renders as "Won"), declined → `lost`.
  `convertLead.js` no longer stamps `converted` at quote-creation time — a
  draft quote is not a won job, and doing so meant every lead skipped straight
  to Won and no lead ever showed Contacted. Only leads carry this; instant
  estimates build a Client and Quote directly and have no `LeadRequest`.

  Approving an instant estimate still leaves the quote in `draft` on purpose —
  it clears `needsReview` (the company confirming the PRICE), which is not the
  client accepting. `/app/quotes` now shows "Needs review" / "Approved — ready
  to send" so the two drafts are distinguishable.

  **Still open:** Job → Appointment does not exist. `Appointment` has no
  `jobId` and `Job` has no appointments back-relation, so a scheduled JobVisit
  appears only on its own job detail page — never on `/app/appointments` and
  never on the assigned employee's schedule. `Shift.jobId` exists and no UI can
  set it. Needs a product decision: unify the three scheduling models
  (Appointment / JobVisit / Shift) or have the calendar read visits too.

- **Feature availability: FieldQuo can withhold a feature per tenant**
  (`lib/features/`, `/platform/features`, `npm run check:features`). A CLOSED
  registry of seven shipped features — voice receptionist, crew inbox, AI
  copilot, funnels, website builder, instant quotes, marketing campaigns — each
  declaring the nav rows, page prefixes, API prefixes and crons it gates.
  Resolution is `companyOverride ?? platformGlobal ?? registryDefault`, with
  four states: `hidden` (no trace anywhere, 404 like any unknown path),
  `preview` (usable and labelled), `locked` (visible, refused, with a reason)
  and `on`.

  Enforced in **two** places on purpose, like the impersonation gate:
  `lib/currentMember.js` covers every API route, and a one-line server
  `layout.js` per route prefix (`app/components/FeatureGate.js`) covers pages,
  so a bookmarked URL is stopped before anything renders. Hiding the nav row is
  cosmetics and the code says so. **Not** in `middleware.js` — see the note at
  the top of that file for why.

  Deliberately a different axis from `Company.aiCopilotEnabled`,
  `crewInboxEnabled`, `sitePublished` and friends: those are ADOPTION (the
  contractor's switch), this is AVAILABILITY (whether FieldQuo offers it).
  Merging them loses the difference between "we don't offer this" and "they
  haven't turned it on", which is the first question on any support ticket.

  Money: withdrawing `voice_receptionist` stops provisioning, stops outbound
  dialling and stops the rent cron — it neither CHARGES nor RELEASES, so
  FieldQuo carries the vendor rental for as long as it has withheld the
  feature, and nobody loses their advertised business number to a switch we
  flipped. The inbound webhook stays ungated (the minutes are already spent).
  Nothing anywhere deletes tenant data.

  `check:features` (319 assertions) fails if a registry key has no consumer, if
  a claimed prefix doesn't call the guard, if a hidden feature's 404 body names
  it, or if an explicit override falls through to the global. Eleven mutations
  were tried against it and all eleven failed the suite.

  **Left:** `lib/apiMember.js` (`memberOrRefusal`) exists because an uncaught
  throw from `getCurrentMember` becomes a Next 500 — which means the billing
  gate's carefully chosen 402 has *never* reached a browser on the ~145 routes
  that still call `getCurrentMember` directly. Only the 22 feature-gated routes
  were converted, because the registry keeps those honest. The rest is a
  mechanical follow-up.

- **The instant-estimate price brain is total** (`lib/estimate/instantEstimate.js`,
  `npm run check:instant-exits`). Every estimator assumed `config.materials` was
  an array of objects and `config.tiers` was iterable, and threw when neither
  held — a saved `materials: [null]` was a `TypeError`, i.e. a 500 on a page a
  stranger loads in a driveway. `sanitiseInstantConfig` had made the *public
  routes* safe by normalising at the boundary, but the assumption itself still
  lived in the estimators, so the guarantee only held for callers who knew the
  boundary helper existed. One `configList()` inside the module now backs every
  list read, and the exits check runs the hostile configs a second time straight
  into `computeInstantEstimate` with the sanitiser bypassed. Shape only, never
  value: 77 well-formed combinations hash identically before and after. Also
  routed `loadCompanyInstantTrades` through the sanitiser — the public trade
  list was the one read of a saved config still going in raw.

- **Trade pricing research + rewire takeoff engine**
  (`docs/trade-pricing-research.md`, `docs/plumbing-material-costs.md`,
  `docs/estimating-standards-and-licensing.md`, `lib/estimate/rewireTakeoff.js`,
  `scripts/check-rewire.mjs`).
  - `rewireTakeoff.js` computes a rewire from **geometry and code rules**, not a
    $/sq ft guess. Device count follows wall perimeter, which makes cable
    sub-linear in floor area (`sqft^0.59`) — every published guide applies a flat
    multiplier and over-buys ~35% of the cable at 3,000 sq ft.
  - **It returns a range and refuses to return a number.** Five required intake
    facts, `codeJurisdiction` among them with **no default**; missing *or
    invalid* gives `typical: null` plus a `needsIntake` list, so no UI can render
    a single price from square footage alone. Copy this gate for any estimator
    where the unknowns swing the answer more than the knowns.
  - **Jurisdiction is a first-class input.** CEC 26-712's split-receptacle rule
    puts a Canadian kitchen on 4 two-pole AFCI circuits where the NEC needs 2
    single-pole. Quebec (CSA C22.10, ~2015 vintage) is **refused, not computed**.
  - Every coefficient tagged `[NEC]` / `[CEC]` / `[READ]` / `[DERIVED]` /
    `[GUESS]`, and the three known simplifications print in `assumptions[]` on
    every result rather than sitting silent in a comment.
  - Legal posture for anything code-derived: **compute quantities, cite rule
    numbers, reproduce no code text and no tables.** See
    `docs/estimating-standards-and-licensing.md` §2.3.

- **Job checklists (phased) + task automation**
  (`lib/jobs/checklistItems.js`, `prisma/seed-checklists.js`,
  `lib/tasks/autoCreate.js`, `app/components/jobs/VisitChecklist.js`,
  `app/app/jobs/[id]/visits/new`).
  - `JobChecklistTemplate.phase` is `pre | during | post`, and the phase is
    stamped onto each item as it's copied to a visit, so a visit's list groups
    itself without reading a template that may since have changed.
  - 168 SYSTEM templates (`companyId` null, upserted on `systemKey`) across 56
    trade keys — `npm run seed:checklists`, idempotent, re-run it after editing
    the item lists. **They are offered, never auto-stamped.** A company that
    hasn't picked a checklist has not stated a process; putting an invented one
    on a real work order is the opening-hours mistake in another costume.
  - Three lifecycle events now write a Task: quote accepted, invoice sent, job
    completed. Idempotency is the `Task.sourceKey` UNIQUE constraint (P2002 is
    swallowed as success), not a read-then-write check — the trigger points are
    a public endpoint a client can double-click and two buttons staff can
    double-click. All three are best-effort and cannot fail the parent action.
  - Attribution: `Task.createdById` is required and there is no system user, so
    auto-tasks borrow the company's owner (then an admin). A company with
    neither — the seeded demo companies, which have no members by design — logs
    and skips rather than inventing one.
  - Fixed in passing: `/app/jobs/[id]/visits/new` did not exist and both "Add
    visit" links 404'd; visit checklists rendered tick icons that could never be
    ticked; `POST /visits` stored whatever JSON the browser sent, so a bare
    string array rendered as a column of "Untitled item".

- **Seat-sharing guard** (`AccountDevice`, `AccountAbuseStrike`,
  `Company.accountStatus`, `lib/security/deviceGuard.js`, `SeatSharingBanner`,
  the standing block in `lib/platform/companyHealth.js`). Detects one login
  being used by a whole crew, warns, and after 3 strikes in 30 days sets
  `accountStatus = "under_review"` and alerts a FieldQuo admin via `recordError`
  (area `account_abuse`).
  - **It never locks anyone out, by design.** Nothing reads `accountStatus` to
    deny access — grep it: two display call sites, no gate. Adding one is a
    product decision, not a refactor.
  - **The two obvious signals are deliberately NOT used.** Concurrent sessions
    and IP changes are both normal here (one person on phone + laptop; a crew on
    mobile data changing address all morning). What is used: >6 distinct device
    fingerprints on ONE login in 7 days, and >3 distinct /16 networks live in the
    same 20 minutes. Both thresholds are set past "unusual" into "cannot be one
    person" — under-flagging is the intended failure mode.
  - The fingerprint (SHA-256 of user-agent + accept-language) is coarse on
    purpose: no cookie, no canvas. It under-counts a uniform crew and
    over-counts one person who changed browser, which is why the headroom.
  - Hooked into `getCurrentMember` — throttled to once per 30 min per
    (user, device), fire-and-forget, never throws, and never runs for an
    impersonation session (the platform must not write into a tenant).

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
  `/login?next=` and `/signup?next=` both bring the contractor back to import.
  - **Job costing:** when the GC quote becomes a job, each import's snapshot cost
    is materialised as a `Subcontractor` Expense on the job (`materializeImportedCosts`,
    idempotent via `QuoteImport.expenseId`), so it flows into margin/costing.
    Removing the import (or deleting its group) deletes the expense too.
  - **Editor reconciliation:** the quote PATCH now reconciles scope groups by id
    (`reconcileScopeGroups`) instead of wiping+recreating — so an imported group's
    linkage survives an editor save — and `reconcileImportsForQuote` drops any
    import whose group the GC deleted, expense and all. No dangling state either way.
  - **Signup auto-return:** a validated internal `?next` threads signup →
    `/api/companies` → Stripe `success_url` → `/app`, which bounces the new
    contractor back to the quote once the subscription reconciles.

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
- **INSTANT-QUOTE estimate email** (`lib/estimate/estimateEmail.js`) — white-
  label, built from documentTheme; gated trades show no figure, financing shows
  no invented monthly amount. Renamed here from "self-quote estimate email":
  it belongs to `/instant-quote/<slug>`, not `/quote/<slug>`, and calling it
  the self-quote email is part of why a round of owner QA was filed against the
  wrong page. The self-quote flow has its own, separate confirmation email
  (`lib/email/selfQuoteEmail.js`). NB this one still builds its own markup
  rather than using `lib/email/documentEmailLayout.js`, so it does not match
  the quote email the way the others now do — see below.

- **Self-quote offers the in-person visit** (`lib/booking/canBookVisit.js`,
  `SelfQuoteFlow` → `BookingFlow` with a `prefill` prop) — compared against
  ottawasbestcabinetrefinishing.ca/get-estimate (a Jobber request form), whose
  one genuine advantage was asking when the homeowner is free. Rather than copy
  its "two candidate dates + arrival window" fields, the confirmation now opens
  the REAL booking flow in place, so the visit is actually booked instead of
  requested: same calendar, same `AvailabilitySchedule` bookable hours, same
  leave blocking, travel-time filtering and visit fee. No second calendar.
  Rendered AFTER submit so a calendar can never cost the lead, and in place
  rather than linked so name/email/phone/address carry over as props — a link
  would have put personal details in a URL. Gated on `canBookVisit`: 11 of 12
  tenants have zero active event types, so ungated this would have been a
  button onto an empty calendar for nearly everyone. `geoAddress` is seeded too,
  so travel filtering engages on the first slot query rather than after a
  retype.
- **Instant estimate: locked until they submit** (`lib/estimate/visibility.js`,
  `after_submit`) — the flow showed the range at step 3 and asked who they were
  at step 4, so a homeowner could read the number and leave without the
  contractor ever knowing. Third mode between "never show" and "show
  immediately"; the existing two are unchanged and unset still means `gated`.
  The lock is real, not a blur: `/measure` returns material labels only plus a
  literal `$X,XXX – $X,XXX` placeholder, and the figure is first computed into a
  response by `/request`, which only runs once a name and a contact method
  exist. `effectiveVisibility(mode, stage)` has **no default stage** on purpose
  — a `stage = "confirmed"` default would leak the figure from any caller that
  forgot the argument. Matches truefinishcabinets.com/quote, which is where the
  pattern came from.
- **Instant-quote budget bands, per trade** (`lib/estimate/budgetBands.js`) —
  three owner-set thresholds, four bands, defaulting to the generic
  `lib/leads/qualifiers.js` numbers. Those generic bands fit a handyman and
  nobody else, and a qualifier answered at random looks like data. The browser
  posts the band INDEX; the server assigns the dollars from its own config (#5).
  Stored on the draft as `estimateData.budget` and read on
  `/app/estimate-reviews`. When the estimate clears their ceiling AND the
  company has financing enabled, the financing block moves up under the figure
  — position only, never a new claim, and provably nothing at all when
  financing is off. Budget and photos are now both required to submit.
- **Client portal knows whether it can take a card**
  (`lib/payments/offlinePaymentNote.js`) — both portal surfaces rendered
  "Pay $X" regardless of Stripe status and 400'd on tap. The flag is derived
  server-side; the connected-account id never reaches the public payload.

- **Self-quote flow rebuilt** (`/quote/<slug>`, `lib/selfQuote/confirmation.js`,
  `lib/email/selfQuoteEmail.js`, `npm run check:self-quote`) — the confirmation
  was four lines of centred text and there was no confirmation email at all.
  Both are now composed from ONE description of the document, so the screen and
  the email cannot drift: masthead, "prepared for", what was asked, then what
  happens next — the order `/q/[token]` and the PDF use. The email pours into
  `documentEmailLayout.js`, the same shell as the quote and invoice.
  `preparedForBlock` moved out of `ClientInfoSection.js` into that layout so a
  route wanting forty lines of HTML no longer drags `@react-pdf` in behind it
  (and the panel's heading is finally translated — it was hardcoded English on
  a section whose PDF twin wasn't).

  Also: Google address autocomplete (degrading to a plain typed field with no
  Maps key — verified by running the server without one), `formatPhoneInput` as
  you type, and the whole form translated. `LeadRequest.language` is new and
  `convertLeadToQuote` seeds `Quote.language` from it, so a homeowner who fills
  the form in French gets a quote CREATED in French rather than one written in
  the contractor's language.

  **Still open, needs a product decision:** `Company.sendLanguages` is read by
  three routes and WRITTEN BY NOTHING — there is no settings control for it, so
  every company reads as `[]` and the language picker correctly stays hidden.
  The picker works (verified by setting the column by hand); it will not appear
  for anyone until that setting exists. Treating `[]` as "offer all six" was
  rejected: a homeowner offered Tagalog reasonably expects a reply in Tagalog.

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
- **The demo booker runs on real availability** (`lib/booking/slotGrid.js`,
  `DemoHostAvailability`, `/platform/demo-availability`,
  `npm run seed:demo-availability`) — the marketing hero used to publish three
  constants: 6–10pm Eastern, every day for a fortnight, weekends and holidays
  included, with a global `unique(scheduledAt)` that capped the whole platform
  at one demo per half hour. Now each `PlatformAdmin` states their own windows,
  `/api/demo/slots` returns the union, and `/api/demo/book` assigns the
  least-loaded free host. Deliberately NOT `AvailabilitySchedule`, which hangs
  off `User` — a platform admin is a different identity system. With nobody
  available the hero shows its empty state; there is no fallback grid, by
  design. Verified by `npm run check:demo-slots` (122 assertions, mutation
  tested).
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
- **The booking page is on `documentTheme`** (`app/book/[companySlug]/`) — it
  used hardcoded ink at 25–50% opacity, which put the weekday headers at 2.1:1,
  and it capped the card at `max-w-md` for every step, which squeezed the
  calendar + times side-by-side layout down to 17px day cells on a desktop. The
  calendar step now widens to `max-w-2xl`, goes two-column at `md` rather than
  `sm`, and every cell and chip is ≥40px. Address entry goes through
  `AddressField.js`, which wraps the shared `AddressAutocomplete` in an error
  boundary: no Maps key, a blocked script or a key without Places all fall back
  to a plain typed address that books exactly as well. Coordinates from Places
  are deliberately not posted — `/confirm` re-geocodes, see its header.
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
