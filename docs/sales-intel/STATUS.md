# Sales build — status

The single place that says what is done, what is moving, and what is waiting.
Updated whenever something lands. If this file disagrees with a memory or a
summary, this file wins.

Last updated: 2026-09-01, after Phase 1 shipped and the Phase 2 audit began.

---

## Phase 1 — Sales portal · SHIPPED

Pushed to `main`. `check:all` exit 0 (257 checks, 19,377 assertions), build
exit 0, schema pushed and verified, row counts unchanged.

| Thing | State |
|---|---|
| Demo accounts cannot spend real money (6 paths) | done |
| Demo accounts cannot email real people | done |
| `PlatformAdminRole` can store `admin` | done |
| Solo contractors can finish onboarding | done |
| Subscription refunds and chargebacks are visible | done |
| Dispute evidence assembled from real usage | done |
| Sales rep identity, invite, `/sales` gate | done |
| Attribution capture, locking, touches, audit | done |
| Commission ledger + milestones 1, 2, 3 | done |
| 60-day retention sweep (cron, 09:20 UTC) | done |
| Rep outreach — send from own mailbox, replies filed | done |
| Demo accounts cannot text real people (8 paths) | done |
| Rep can text their signup link, with STOP handled | done, blocked on a number |

### Phase 1 — still open

- **Blocks reps sending mail** (owner action): verify the reps' root mail
  domain in Resend; set `SALES_MAILING_ADDRESS`; set
  `SALES_REPLY_ADDRESSING` to `plus` or `plain` (no default on purpose — a
  wrong choice bounces replies to the prospect).
- **Does not block sending**: `SALES_INBOUND_SECRET` plus the mailbox
  forwarding rule; without it the portal honestly says replies are not being
  filed.
- **Blocks reps texting** (owner action): FieldQuo holds no `sales`-purpose
  number. Buy one in the platform console under Crew lines with the purpose set
  to “Sales”. It must NOT be the `system` number: that one sends on behalf of
  contractors, so a STOP arriving there means “stop texting me about my kitchen
  quote” and cannot be honoured as a sales opt-out. Until one exists the send
  panel renders no button and names this as the missing thing.
  `SALES_MAILING_ADDRESS` is the same setting the email footer needs — CASL
  requires it in a commercial text too, and nothing sends without it.
- **SMS demo hole — CLOSED.** `lib/sms/twilioClient.js` now substitutes at the
  vendor seam exactly as `lib/email/resend.js` does, and all eight tenant-scoped
  send paths pass `companyId`. A demo's text is recorded as an
  `sms.simulated` ActivityLog row and never reaches Twilio; the product still
  records everything a real send would have, so a walkthrough still works.
  `scripts/check-sales-sms.mjs` executes it.
- **SMS timing is NOT the calling window** — checked rather than assumed.
  CASL governs commercial texts and imposes no time-of-day rule; the CRTC
  09:00–21:30 / 10:00–18:00 hours are for telemarketing *telecommunications*
  (voice/fax). What binds a text is the TCPA's 08:00–21:00 local window, which
  the FCC and the courts apply to texts as to calls and which has no B2B
  exemption for mobiles. So `lib/sales/smsWindow.js` is a third window, flat
  across the week, and reuses `callingWindow.js`'s `localTimeIn` rather than its
  bounds. Consequence worth knowing: `SalesLead.timeZone` is required before a
  text can go out, is stated by the rep, and is never inferred from an area
  code.
- Outreach screens are English-only while the rest of the portal is translated.
- Weekly payout batches: the model exists, the closer does not.
- Rep dashboards, leaderboard, CAC, cohorts, fraud review — Phase 5 of the
  original plan, not started.

---

## Phase 2 — landed overnight 2026-09-01

| Thing | State |
|---|---|
| Phase 2 schema — 18 models | pushed, verified |
| Platform-wide suppression list (email / phone / domain) | done, 260 checks |
| Sales calling window, Canada's rules, prospect's timezone | done |
| Pipeline task runner — atomic claim, reclaim, backoff | done, 123 checks |
| FieldQuo capability matrix — 27 in, 11 excluded | done, 182 checks |
| Opportunity + confidence engines | done |
| Weekly payout batches | done, 32 checks |
| Four live voice bugs | fixed, 89 checks |
| FieldQuo's own AI + voice spend, at cost | done |
| Rep work mailbox, separate from login | done |
| Rep signup link + per-day counts | done |

### The mobile check, and what it honestly proves

`check:mobile` now runs over all of `app/platform` and `app/sales` — 55 files,
measured clean, with an empty known-gaps list. It proves the ABSENCE of six
mechanical hazards: containers wider than a phone, a `<table>` outside an
`overflow-x-auto` wrapper, `whitespace-nowrap` with nothing to scroll in,
anything defeating the deliberate iOS 16px input rule (including moving that
rule inside `@layer`, which would silently disarm it), touch targets under
36px, and fixed-height dialogs.

It does **not** prove a layout is usable, that anything fits at 375px, or that
controls are labelled — there is no browser and no rendered box. Class names
assembled at runtime are counted as SKIPS and never passed. Two heuristics are
labelled as heuristics: the scroll-ancestor lookback cannot see a wrapper in a
parent component, so it fails safe rather than passing wrongly; and the floor
is 36px rather than Apple's 44, because 44 would fail most existing console
buttons and get the rule deleted. New screens use 44.

### Rule consoles: three tables a superadmin could only edit by hand

`OpportunityRule`, `ConfidenceRule` and `TechnologySignature` now have screens.
Three findings worth keeping:

- **A rule is versioned when the edit changes what it DECIDES**, not when it
  changes a label. Results stamp `ruleVersion`/`signatureVersion`, so mutating
  conditions in place would make a stored row cite something that no longer
  exists.
- **`ConfidenceRule.version` is the honest exception** — nothing stamps a
  confidence version onto a stored figure, so it is a change counter and the
  screen says so rather than implying a provenance trail it cannot deliver.
- **`TechnologySignature` has no consumer at all** — no detector, no crawler.
  The screen carries a permanent banner saying nothing reads `patterns` yet,
  and validates shape only. Behaving as though editing a pattern started
  fingerprinting would be a feature flag for a feature that does not exist.

**My brief was wrong about translations.** Zero of the 30 existing `/platform`
pages use i18n — the console is English-only by convention — so adding `t()` to
three superadmin screens would have been inconsistent, not correct.

### A check that printed ALL PASS while skipping 20 assertions

Found by mutation-testing the check itself, not by reading it. `ok()` returned
`undefined` on its passing branch, so `if (!ok(...)) continue` silently skipped
twenty handler assertions and still reported success. 146 → 166 checks once
fixed.

That is the fifth false-pass of this kind in this project, and every one was
found the same way: by breaking the code and watching whether the check
noticed. A check nobody has tried to fool is a claim, not evidence.

### SMS: a "Reply STOP" that went nowhere

The sharpest catch of the night, and it had legal teeth rather than merely
being a bug.

`buyPlatformNumber` hard-wires the CREW webhook. A sales number bought as-is
would have pointed at `/api/crew/inbound`, resolved to nobody, and **dropped
every STOP with a silent 200**. So the message would have carried a "Reply
STOP" line with nothing behind it — an unsubscribe that does not unsubscribe,
which is both the dead-control failure AGENTS.md forbids and a CASL/TCPA
problem. Fixed with a purpose-aware webhook URL.

Two more distinctions that mattered:

- **STOP must NOT reverse on START here.** The tenant path does reverse it,
  because carriers expect that. The sales path must not, because
  `lib/sales/suppression.js` deliberately has no self-service removal — an
  opt-out binds FieldQuo and only a superadmin lifts it, with a reason.
- **The SMS window is NOT the voice window.** I told the agent to reuse
  `lib/sales/callingWindow.js` and it correctly reused only the timezone
  helper. CASL governs commercial texts and has no time-of-day rule; the CRTC
  09:00–21:30 / 10:00–18:00 hours are for telemarketing *telecommunications*.
  What binds a text is the TCPA's flat 08:00–21:00 local window. Reusing the
  voice bounds would have been simultaneously non-compliant and needlessly
  restrictive.

Also: **nothing in the product knew where a prospect is.** Neither `SalesLead`
nor `Prospect` had a timezone, so any window at all would have blocked every
send. `SalesLead.timeZone` is now stated by the rep and never inferred from an
area code — a mobile number's area code is not where its owner lives.

**Eight SMS paths existed, not the one I named in the brief.** All eight now
carry `companyId` so the demo guard can re-derive it at call time.

### Three bugs found in MY shipped work, by the agents reviewing it

1. **`deliverOutreach` had no opt-out check at all.** The gate was
   `leadIsOptedOut`, called by two routes — so any third caller of the send
   function bypassed the opt-out entirely. The check now lives inside the send.
2. **Those routes never loaded `lead.phone`.** So "opt out by phone, then
   receive an email" would have silently passed even with the guard in place.
3. **`check-sales-outreach.mjs` contained an assertion encoding the bug** —
   it asserted that an opt-out reached only the receiving rep. A check that
   proves the wrong behaviour is worse than no check. Inverted.

Also: `app/api/settings/referral/invite/route.js` was never in the audit and
sends over FieldQuo's shared number. Its own comment said "there's no 'this
company's opt-out list' for this recipient to be on" — true of the tenant list,
and a hole the moment FieldQuo had one of its own. Now guarded.

### Where the capability agent corrected the brief

- **There are no plan-tier differences to note.** Solo/Crew/Shop/Scale differ in
  seats, crew and price and in NOTHING else — asserted by `check:feature-matrix`
  against the seat ladder. What varies is metered usage, so "AI included" would
  have been a false claim about our own pricing.
- **"Limited published hours" was unbuildable as specified.** That needs an
  hours count and no column holds one; inventing a threshold is the exact
  padding-absent-data failure `businessHours.js` exists to prevent. The rule
  fires on NO published hours at all — a real reading of a real page.
- **"Only pitch what FieldQuo does better than the competitor" needs a
  competitor feature map that is not sourced.** Asserting Jobber's feature list
  from memory would put an unverified third-party claim in a rep's script.
  Inverted into a claim about US — is this table stakes any FSM would carry? —
  which can only remove talking points, never invent one.

**11 capabilities were EXCLUDED**, each with the reason in code and on screen:
no live chat exists at all; the Marketing Designer is built but no page mounts
it; social publishing has no Meta connection; custom fields are written and
never read; warm transfer saves a column nothing reads. Payroll, contractor
payouts and client financing are real but deliberately kept out of a cold-call
script — partial, and a rep summarising their limits on a phone is how an
unkeepable promise gets made.

## Phase 2 — Sales intelligence, prospecting, telephony, copilot

Specified 2026-09-01. The spec's own §64 says to audit before writing code, so
that is what is happening.

**Now:** the compliance audit is still running. A separate agent is fixing four
live voice bugs found during the audits. Nothing of Phase 2 is being built.

### Platform suppression list — BUILT (checklist item 10 and 11)

The audit's largest compliance build item. `SalesSuppression` and
`SalesSuppressionEvent` are pushed and verified: FieldQuo-wide, keyed
independently on normalised email, E.164 phone and registrable domain, and
scoped to nothing — no `companyId`, no `salesRepId`. An unqualified "stop"
closes every channel, because a phone opt-out has to stop the email too.

- **Enforced on both outbound paths.** `lib/sales/outreachSender.js`'s
  `deliverOutreach` re-reads the list immediately before `sendEmail`, on the
  `canWrite()` discipline. The second path was **not in the audit**:
  `app/api/settings/referral/invite/route.js` sends over FieldQuo's own Twilio
  number and `invites@fieldquo.com`, and its own comment said there was no
  opt-out list the recipient could be on. There is one now, and it is checked.
- **`leadOptedOut` is superseded, not deleted.** `leadIsOptedOut` (rep-scoped,
  email-only) is gone; `contactOptedOut` reads the platform list first and then
  the inbound messages of **every** lead sharing the address. The derived
  signal is kept because replies filed before the list existed still carry a
  real opt-out. An inbound "unsubscribe" now writes the suppression in the same
  transaction as the message, keyed on the address FieldQuo wrote to — never on
  the reply's forgeable `From`.
- **Retention.** Three years and fourteen days, computed on the calendar (not
  `3 * 365`) and stored per row as `retainUntil`. Removal is a superadmin-only
  soft `removedAt` with a mandatory reason; nothing deletes, and the required
  relation to `SalesSuppressionEvent` makes the database refuse a delete too.
- **Screen.** `/platform/suppressions` — search, add, bulk import, remove with
  a reason. Superadmin only. No "coming soon" panel; every control works.
- **Calling window** (checklist item 12, the rule only). `lib/sales/
  callingWindow.js` — 09:00–21:30 weekdays, 10:00–18:00 weekends, in the
  prospect's own zone, refusing outright when the zone is unknown. Separate
  module from `lib/voice/outbound.js`'s `CALL_WINDOW`, which is untouched and
  correct for homeowners. **Nothing dials yet.**
- `scripts/check-sales-suppression.mjs`, in `check:all`. 260 checks, 21
  mutations tested and all caught.

Still open from the audit's checklist: 13 (consent basis per prospect), 14–15
(call script and per-call log), 16 (recording retention), and every `[OWNER]`
item — the DNCL registration above all.

### Jobs / AI / data-model audit — DONE (`AUDIT-jobs-ai-model.md`)

**Most of a job queue already exists, split across two files that never met.**
`VoiceCallTask` has the status machine, `notBefore`, `attempts`, `lastError`
and the right index. `lib/voice/autoTopup.js` has the compare-and-set claim,
a stale-claim timeout, and token reuse so a reclaim keeps its idempotency key.
Together that IS the pipeline table — it does not need inventing, it needs
joining up.

**A thousand prospects is about TWO days, not one.** Corrected after the runner
was actually built and the arithmetic done properly:

- 6 ticks/hour × 24 = 144 invocations/day. At a batch of 25 that is a ceiling
  of 3,600 tasks/day.
- A 1,000-prospect campaign is roughly 7 tasks per prospect plus discovery
  paging — about 7,050 tasks.
- 7,050 / 3,600 ≈ **1.96 days**, plus a tail, because a prospect's stage N+1
  cannot be enqueued until stage N finishes.
- **The binding lane is OpenAI**: three of the eight stages share one budget of
  10 per run = 1,440/day against 3,000 tasks, so that lane alone is 2.08 days.

Getting to one day needs a batch of 50 AND the OpenAI ceiling raised past 21
per run. That was deliberately NOT decided by the agent, because it depends on
how long one invocation may run and **no `maxDuration` is exported anywhere in
this repo** — every function runs at whatever the Vercel dashboard says, which
code cannot read. Nobody invented a number, which is right.

Since the owner has confirmed volume is set in the admin UI and runs
overnight, two days is not obviously a problem. It is recorded so the
expectation is honest rather than discovered later.

**Structured AI output does not exist here yet.** There is no schema library
and no `response_format`/`json_schema` anywhere — today it is prompted JSON,
fence-stripping and hand-coercion across six callers. §59 asks for validated
structured output, so that is new work, not a convention to follow.

**FieldQuo's own AI spend is invisible.** `AiUsage.companyId` is NOT NULL and
`recordAiUsage` returns null without one. There is precedent for spending
unmetered (anonymous Jennifer calls the model with no metering, deliberately),
but a prospecting pipeline spending at volume needs a budget ceiling that
`checkAiQuota` has no untenanted equivalent for.

**Prospect and SalesLead are TWO things, joined by a nullable FK.** The
decisive argument is money, not taste: `SalesLead.convertedCompanyId` is
`@unique`, and a second path from `Prospect` to `Company` would give the
commission ledger two disagreeing answers about who is attributed. One entity
would also force a rep-owned, cascade-deleted row to hold org-wide discovered
data.

**No territory model exists at all.** Geography is nullable coordinates on five
models. `haversineKm`/`hasPoint` in `lib/booking/travel.js` are pure and
reusable, so a radius territory works today; polygons or postcode sets are new.

**No crawling exists**, and the existing rate limiter cannot serve it: it is
inbound-only and lives in lambda memory, which is precisely what per-host crawl
politeness cannot use. That has to be a database column.

**A gap in what shipped last week:** `lib/sales/outreachSender.js` has no send
caps at all, so campaign volume limits do not exist yet.

### STANDING RULES — apply to everything, not just the next thing

Set by the owner 2026-09-02. These are not per-task requirements; they are
conditions every screen has to meet before it counts as done.

1. **Every setting and every rule is editable from the superadmin UI.** Not a
   seed script, not a constant, not a database row somebody edits by hand.
   Confidence weights, lead-score weights, technology signatures, capability
   mappings, opportunity rules, refresh intervals, playbooks, objection
   responses, experiment configuration, territories, phone pools, QA
   scorecards, AI prompt versions. The spec says this at §47 and it is easy to
   half-do: shipping the table and the seed, and calling it configurable
   because a superadmin *could* edit the row. That is not a UI.
2. **Mobile friendly — both surfaces.** The superadmin console AND the sales
   rep view. The rep one matters most: a rep checks their queue and their
   numbers on a phone, and the whole point of the portal is low administrative
   overhead. A screen that needs a laptop adds overhead.

A screen that fails either of these is not finished, whatever its check script
says. Neither is caught by `check:all` today, which is exactly why they are
written here.

### SETTLED BY THE SPEC — read this before proposing anything

These are decisions the owner already made in the Phase 2 document. They are
NOT open questions, and an audit finding does not reopen one. I got this wrong
twice on 2026-09-01 — treating an agent's finding as authoritative over the
brief — so they are written down here where an agent brief can point at them.

| § | Settled |
|---|---|
| 23 | **Twilio is the telephony provider**, behind a provider interface so Telnyx could replace it. Retell is the AI receptionist and is not the rep-calling path. |
| 25 | **No caller-ID spoofing.** Only numbers FieldQuo controls and is authorised to present. |
| 2 | Fact / inference / AI-recommendation stay separate in the database AND the UI. |
| 5 | **No website is a SIGNAL, not a disqualifier.** Those prospects stay in the pipeline. |
| 6 | Do **not** architect around scraping LinkedIn. Unknown owner stays null. |
| 7 | Do **not** assume BBB offers an unrestricted public API. |
| 11 | **Never recommend a capability FieldQuo does not actually have.** |
| 18 | Deterministic rules-based lead score first. No invented conversion probabilities before there is data. |
| 29 | STT behind an abstraction. No hard-coded model names or prices. |
| 38 | Reps must **not** choose their own experiment variant — assignment is stored before the call. |
| 39 | No declaring a winner without the sample size to support it. |
| 43 | Territory assignment rules-based first; no opaque ML. |
| 52 | No hard-coded vendor prices. Configurable pricing tables. |
| 58 | **Deterministic software for what software can determine.** AI only where interpretation is genuinely valuable. The §58 lists are the boundary. |
| 59 | Structured, validated AI output. Generated prose never mutates a CRM field directly. |
| 62 | Provider interfaces around Google, Twilio, OpenAI. |
| 64 | Audit before code. |

**Working rule that follows:** when an audit finding and the spec disagree, the
spec wins until the owner says otherwise. Report the tension; do not resolve it
by quietly adopting the finding.

### Telephony audit — DONE (`AUDIT-telephony.md`)

**Two vendors are wired and neither carries a human's voice.** Retell places
outbound calls but both legs are the provider's — there is no human leg and no
browser token anywhere. Twilio is SMS and a number catalogue only: no Voice
SDK, no `calls.create`, no access tokens, and the only TwiML in the repo is an
empty document. So §23's browser calling is genuinely new, not an extension.

**The best reuse finding:** `PlatformVoiceCall` already exists, and exists
*precisely because FieldQuo must not become a Company row*. That is the
pattern the sales build extends rather than inventing a parallel one.

**The hard constraint:** sales numbers must NOT live in `VoicePhoneNumber`.
Its `companyId` is a required FK and `heldNumber()` enforces one-per-company —
a pool is structurally the thing that code treats as a bug. Putting them there
would make the rent cron bill a non-company, make `derivedSpend` count sales
minutes as tenant burn, and report a false billing leak per number.

**Vendor split, settled by the owner 2026-09-01 — do not re-open:**

> Twilio carries the humans. Retell carries the AI receptionist.

I had raised Retell concurrency contention as a risk. That was my error: it
assumed rep calling would ride Retell. It should not. Retell is a per-minute AI
voice agent — the wrong tool and the wrong price for a human rep talking to a
prospect. Twilio Voice is materially cheaper per minute and has no concurrency
slots to contend for.

Consequences of the split:

- **The Retell concurrency pool tenants depend on is untouched by sales.** The
  risk I raised does not exist under this architecture.
- **Twilio is already wired** — credentials, number search, webhooks — for SMS
  and the number catalogue. The account and plumbing exist; Voice does not.
- **`lib/voice/numberSearch.js` is directly reusable for the pool.**
  `areaCodeOf` with N11 rejection, `defaultAreaCode` that returns null rather
  than inventing, and `isStillAvailable` returning true/false/**null** are
  exactly what caller-ID selection needs.
- **Live transcription changes shape.** It would come from Twilio Media
  Streams into an STT provider, not from Retell. Cleaner: the AI receptionist
  and the copilot stop sharing a vendor.

Still true from the audit: Twilio has NO Voice today — no SDK, no
`calls.create`, no access tokens. Browser calling is new work. It is just new
work on Twilio rather than on Retell.

### Live bugs found in passing (not Phase 2 — today)

1. `FIELDQUO_SALES_NUMBER` already reports as an unheld billing leak on the
   platform console.
2. `recordSalesCall` bypasses `transcriptFrom()`, so sales transcripts silently
   lose tool calls.
3. `reconcileCalls` maps from `voicePhoneNumber` only, so a dropped webhook on
   a sales call is **lost permanently** — no retry, no recovery path.

**Next:** the 18-section plan §64 asks for, then phasing.

### ✅ DISCOVERY SOURCE — ANSWERED: Overture, and it is free

**The rejection was a misunderstanding, verified empirically rather than
argued.** Overture membership ($3M / $300k / $3k / $0) buys governance
influence — a vote on prioritisation. Data access is not a member benefit
anywhere on that page. The agent proved it by doing it: anonymous,
unauthenticated listing of `s3://overturemaps-us-west-2/release/` succeeded,
and the current places theme measures **16 Parquet files, 9.76 GiB, $0**.

**The share-alike fear does not apply to the theme we need.** ODbL covers
base/buildings/division/transportation. The **places** theme is
CDLA-Permissive-2.0 / Apache-2.0 / CC0 and contains no OSM data. CDLA's only
obligation attaches to *sharing* data, and it says outright that it imposes no
restriction on the use of Results — a definition that includes model outputs,
which is the exact activity Google's §3.2.3(c)(vii) forbids.

Taxonomy confirmed by downloading and grepping the 2,118-category CSV:
`painting`, `plumbing`, `hvac_services`, `roofing`, `landscaping`,
`flooring_contractors`, `cabinet_sales_service`, `carpenter`, `electrician` are
first-class `home_service` categories. Schema carries phones, websites, emails,
socials, addresses and a confidence field. No rating or review count.

### Google is not just prohibited — it is structurally incapable

This outranks the licence question and settles it twice over. On the CURRENT
Places API (New):

- **Nearby Search caps at 20 results with NO pagination token at all.**
- Text Search returns *"a maximum of 60 results across all pages"*.
- The Places Aggregate API — the product built to answer "what is in this
  area" — returns place IDs only, and only when the count is 100 or lower.

Grid-searching one trade in Ottawa is ~2,790 requests, about **$89, still
incomplete**, and is precisely the systematic extraction the terms name. So
Google could not enumerate a city's contractors even if it were allowed to.
It stays as a live `place_id`-only verification step, which its terms permit.

### The one honest gap in that recommendation

Overture's `phones` and `websites` COLUMNS exist; how often they are POPULATED
for North American trades is unmeasured — that needs the 9.76 GiB pulled and
counted, which was outside a read-only remit. **That is the first
implementation step, not an assumption.** A ~$150 Data Axle list is worth
buying as a BENCHMARK to measure Overture's real coverage against a paid one —
not as a source.

Also unverified and worth asking in writing before any purchase: whether Data
Axle's list licence permits AI processing and perpetual re-use. That is the
clause that would make a bought list useless here.

### Ruled out, with the clause that decides it

- **Yelp / Yellow Pages / Google-derived scrapers — PROHIBITED.** Yelp §5(b)
  names it outright: *"use it to update or create your own database of business
  listing information"*, and §9.4 bans putting Yelp content into a generative
  model at all.
- **OpenStreetMap — dead on coverage, not licence.** 6,400 `craft=painter`
  objects on the entire planet.
- **Registries — unfit.** StatCan ODBus has no phone, no website, no email.
- **Foursquare OS Places — permitted but redundant.** Its rows are already
  inside Overture, and since Oct 2025 it needs a portal account.

### Superseded — kept because the reasoning still matters

**Read this before anything else.** Compliance audit, 2026-09-01, sourced.

The Maps Platform ToS (last modified 2026-08-26) is not ambiguous:

- **§3.2.3(a)(iii)** names *"copy and save business names, addresses, or user
  reviews"* as an example of prohibited scraping. That is the Prospect table.
- **§3.2.3(d)(iii)** bars use *"in a listings or directory service or to create
  or augment an advertising product."* That is this product.
- **§3.2.3(c)(vii)** bars using Maps Content to *"train, test, validate or
  fine-tune"* models. That is the AI analysis step.
- Service Specific Terms §14.3 permit caching **lat/lng only, 30 days**.
  `place_id` may be stored indefinitely. Nothing else.

No retention setting, attribution or refresh policy fixes this. It is not a
caching problem to tune; it is the wrong source.

**And the blast radius is the live product, not the experiment.** §5.2(d)
permits immediate suspension of the key — the same key that powers address
autocomplete, the mini-maps, distance matrix, and the Solar roof measurement.
A suspension would take working contractor-facing features down alongside a
prospecting trial.

**Recommended replacement: Overture Places** — CDLA-Permissive v2.0, ~59M
POIs, commercial use permitted. Google Places can stay as a live,
`place_id`-only verification step, which its own terms allow.

**This is the owner's decision** and nothing has been built on either option.
The schema is deliberately neutral: `ProspectCampaign.discoveryProvider` has
NO default, so a campaign must name its source rather than inherit the one
that cannot legally serve it.

### Cold calling is available, and cheaper than expected

- **Canada:** B2B is exempt from the National DNCL *rules*, but registration
  at `lnnte-dncl.gc.ca` is **free and mandatory anyway, even for exempt
  callers**. The Telemarketing Rules still bind: **09:00–21:30 weekdays,
  10:00–18:00 weekends, in the PROSPECT's timezone**, identification with a
  callback number, and an internal do-not-call list kept **three years and
  fourteen days**.
- **US:** 16 CFR 310.6(b)(7) exempts B2B from the TSR almost entirely, so the
  $23,425/yr Registry subscription is very likely unnecessary. But the **TCPA
  has no B2B exemption for prerecorded/artificial-voice or autodialled calls
  to mobiles**, and small contractors answer on mobiles. The constraint that
  keeps this simple: a human dials, one call at a time.
- **The reps' location is not a legal issue.** The destination country's rules
  govern, and because FieldQuo is registered in both countries the regulator
  reaches the company. One live item to watch: FCC NPRM FCC-26-16A1
  (27 March 2026) would require disclosing that an agent is outside the US —
  a proposal, not a rule, currently aimed at telecom providers, and Ukraine is
  not on its adversary-nation list.
- **Twilio:** local caller ID is permitted only on numbers actually bought and
  answered; falsifying origin is enforced mechanically (error 21210). Being
  registered in both countries satisfies the bundle requirements.
- **Canada's rules are under open review right now** (CRTC 2026-132) — the B2B
  exemption could move.

**Sourcing caveat, stated rather than hidden:** `crtc.gc.ca` sits behind bot
protection that blocked every automated fetch. The agent stopped rather than
working around it — the same standard it recommends for crawling. CRTC figures
came via search extraction. **A human should open the rules page before anyone
pays for anything or ships a calling window.**

### No platform suppression list exists — being built tonight

Searched properly: nothing. `CallConsent` and `MarketingSubscriber` are
tenant-scoped. The one sales opt-out, `leadOptedOut()`, is scoped to a single
`SalesLead`, and `SalesLead` has no unique constraint on email — so two reps
can hold the same prospect and an opt-out silences only one of them. It is also
email-only.

An opt-out binds FieldQuo, not a rep's copy of a row. An agent is building the
platform-wide list now.

### Answered by the audit — no longer open questions

Recorded as ANSWERS so nobody re-raises them as risks. That happened once
already and it wastes the owner's attention.

- **Canada — cleared.** B2B is exempt from the DNCL rules; registration is free
  and mandatory anyway. Window 09:00–21:30 weekdays, 10:00–18:00 weekends, in
  the PROSPECT's timezone. Identify with a callback number. Internal
  do-not-call list kept 3 years + 14 days.
- **US — cleared.** B2B is almost entirely exempt from the TSR; the $23,425/yr
  Registry subscription is very likely unnecessary. TCPA still applies to
  prerecorded voice and autodialling to mobiles, so: a human dials, one at a
  time.
- **Twilio — cleared.** Area-code-matched caller ID is permitted on numbers
  actually bought and answered, which is what the design does. Falsifying
  origin is enforced mechanically (error 21210) and nothing here attempts it.
  Registration in both countries satisfies the bundle requirements.
- **Rep location — not a legal issue.** Destination rules govern; the regulator
  reaches the company.

**The one open human task:** `crtc.gc.ca` blocked every automated fetch, so a
person must open the rules page before anyone pays for anything or ships a
calling window.

**Still genuinely open:** the discovery source (see the blocker above), and
cost at volume.

### Decisions already taken (Phase 2)

- Audit before code, per the spec's own instruction.
- Nothing built until the plan is presented.

### Decisions waiting on the owner (Phase 2)

- Whether live in-call AI copilot is in the first build, or post-call only.
- Phase order — the spec puts telephony sixth; see the plan when it lands.

---

## Decisions taken, Phase 1 (do not re-litigate)

- **Milestone 1 is Stripe Connect activation alone.** Onboarding completeness
  is never part of it: a one-person shop can never complete onboarding, so
  that gate would pay nothing on an entire class of real sale.
- **The referral programme and the sales programme have different fraud
  postures on purpose.** Referrals pay on first payment because throwaway
  addresses are free; sales pays at activation because Stripe verifies a
  government ID and a bank account. Do not harmonise them.
- **Annual subscribers qualify for the 60-day milestone.** They have made no
  second payment, but they are still paying customers. Their larger refund
  exposure is a price to set, not a branch to write.
- **A sales rep is a third identity**, not a Member and not a PlatformAdmin.
  Both credentials refuse the other's token.
- **A second rep's touch is recorded, never refused.** A contractor's signup
  must never depend on our commission bookkeeping.
- **A rep cannot attribute a company to themselves.** Manual attribution is
  superadmin-only today.

## Decisions taken 2026-09-01 (evening) — Phase 1

**A rep gets a signup link, and the link IS the claim.** `/signup?sales=CODE`,
the same shape as the contractor referral link. So "can a rep claim a company
themselves" stops being a question rather than getting an answer: there is
nothing to claim, because attribution happens when the COMPANY acts. The
property that mattered survives untouched — a rep still has no write path to
`SalesAttribution` and cannot pay themselves by asserting a relationship that
did not happen.

It also gives the owner the number he actually wanted: "Daniel signed up ten
companies today" is a count of attribution rows, computed rather than stored,
so it cannot drift from the rows it describes.

**The sales link grants the contractor NOTHING extra.** Just the normal trial —
no free month, no credit, no banner on the signup page. Verified in
`app/api/companies/route.js`: `salesCode` is resolved independently of the
promo/referral waterfall, and nothing in that path grants a reward. The
referral programme gives a month; this does not. The rep side tracks it for
compensation, and that is the whole difference.

**Two reps, one company: prevented upstream, not arbitrated afterwards.** The
owner's point is operational rather than accounting — a contractor must not be
phoned by two reps in one week. So `Prospect` now carries `assignedRepId`,
`assignedAt` and `claimExpiresAt`: a rep claims before calling, and an unworked
claim lapses so one rep cannot freeze the list by claiming two hundred and
calling nine. Attribution at signup still decides who is paid; ownership stops
the collision happening at all.

## Decisions waiting on the owner (Phase 1)
3. Flat commission across all four plan tiers?
4. Does a departed rep keep earning the 60-day milestone?
5. How much of a contractor's data may a rep see? (Default today: name,
   signup date, milestone states, subscription status. Nothing else.)
