# Sales build — status

The single place that says what is done, what is moving, and what is waiting.
Updated whenever something lands. If this file disagrees with a memory or a
summary, this file wins.

Last updated: 2026-09-03, after all-trades campaigns — banking every trade, a
research budget on the expensive half, and the queue still single-trade.

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

- **Sending is NOT blocked by DNS.** An earlier version of this file said the
  reps' root domain had to be verified. That was my error: a provider needs a
  verified DOMAIN to send FROM and does not need a mailbox there. From is on
  the verified sending subdomain; Reply-To is the rep's real mailbox, which
  needs nothing verified because nothing sends from it. Verifying the root
  domain is optional polish, not a blocker.
- **Owner actions, three values:** `SALES_MAILING_ADDRESS` (the business postal
  address CASL requires); `SALES_REPLY_ADDRESSING` = `plus` or `plain`, decided
  by emailing `contact+test@fieldquo.com` and seeing whether it arrives;
  `SALES_INBOUND_SECRET` = `openssl rand -hex 32`, same value in the mailbox
  forwarding rule.
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

### Discovery — Overture places become Prospect rows · BUILT 2026-09-02

`DISCOVER_BUSINESSES` is the first of the eight pipeline stages with a real
handler. `scripts/check-sales-discovery.mjs` — 314 checks, 74 mutations tested,
all caught — is in `check:all`.

**DuckDB CANNOT run inside a Vercel function, and the alternative shipped
instead.** Four independent reasons, any one fatal: the measured scan is ~60
seconds and no `maxDuration` is exported anywhere in this repo; a multi-threaded
Parquet scan over 9.76 GiB is sized for a workstation; `@duckdb/node-api` is a
native addon of tens of megabytes whose `httpfs` extension is downloaded and
verified at RUN time; and re-scanning a city per campaign answers a question
whose answer changes twelve times a year. So `npm run overture:snapshot` runs
the DuckDB **CLI** offline — nothing entered `package.json` — writes an NDJSON
snapshot with a manifest naming the release, and the campaign's
`sourceConfigs.overture.snapshotUrl` points at it. **A campaign cannot discover
anything until somebody has produced its snapshot**, the screen says exactly
that, and the handler refuses with that sentence rather than reporting an empty
result.

Keyed per source since 2026-09-03, when a campaign gained a SET of sources:
every source shipped so far has a config field called `snapshotUrl`, so one
blob for several sources means the second source reads the first source's file.
`providerConfig` is still READ for campaigns created before that date, and is
no longer written.

**The release is looked up, never hard-coded.** An anonymous S3 listing —
plain `fetch`, no SDK, no account — and a beta prefix or a truncated listing
yields null rather than a stale month.

**Classifier precision, hand-checked on a stratified draw of 120 rows out of
222,337 classified:** retailer **93.3%** (56/60), contractor **98.3%** (59/60).
Overall shape: 91.6% contractor, 2.8% retailer, 5.6% needs review. Every one of
Benjamin Moore, Dulux, Betonel, Sherwin-Williams, PPG and Sico is rejected —
including the Benjamin Moore rows filed as `painting` with no alternate
category at all, which no structural rule can catch.

**The first version scored 73% and had to be rebuilt.** It treated
`wholesale_store` / `building_supply_store` as decisive and rejected Whistle
Stop Fence Co, A1 Quality Decks, Hudson Valley HVAC and Cleveland Air Comfort —
contractors that sell what they install. A structural retail signal is now a
QUESTION; only the NAME (a chain, or supply / wholesale / distribution) decides
alone. `home_improvement_store` as an alternate is measured NOISE — 6,128 of the
nine core categories' rows carry it, including CertaPro Painters and Wow 1 Day
Painting — and is deliberately in none of the lists.

**A freshness bug found by running the real extractor, not by reading.** EVERY
Overture row carries a derived `/properties/confidence` source whose
`update_time` is the RELEASE BUILD DATE. "Newest source" therefore reported
today for every row in the dataset — "Eco Painting Plus", last actually touched
in September 2015, would have shown as refreshed three weeks ago, which is the
exact opposite of what carrying the field is for. Only record-level
contributions now count. After the fix, 13 of 111 Ottawa painting rows are
correctly flagged as over two years old.

**A second bug the check found:** `Number(null)` is `0` and `0` is finite, so a
row with no coordinates survived the radius guard and had its distance measured
from the equator.

**Live, end to end, against the current release (`2026-08-19.0`):** Ottawa
painting, 25 km radius — 89 found, 11 not usable for this campaign, 7 shops
rejected, 1 needs review, **70 accepted contractors, 67 ready to call**. That
matches the independent measurement's "70 painting contractors in the City of
Ottawa" almost exactly.

**Decisions worth not re-litigating:**

- `Prospect.tradeKey` is NOT a `ServiceCategory` key. A catalogue key is a
  QUOTE TYPE and a painting contractor sells two of them; the catalogue itself
  already refused to pick one as primary. `lib/sales/discovery/trades.js`
  declares a coarser unit over catalogue keys, and the check asserts every one
  it names is real.
- `hasWebsite` stays NULL when the source lists no website — never `false`.
  Overture's website fill is 92.7%, so an empty column is a gap in the
  directory as often as a gap in the market. The funnel line reads "No website
  listed by the source", and only a crawl may make the stronger claim.
- `confidence` is stored and never gated on, per the measurement. The check
  asserts no WHERE clause names it.
- Only an exact `(provider, record id)` match removes anything. A phone, domain
  or name+locality match FLAGS. The database's own unique index is the dedupe
  guarantee; `skipDuplicates` was rejected because it would count a row as
  accepted that was never written.

**Still open:** territories can be created with a campaign and reused, but
there is no screen to rename or re-draw one — stated on the page rather than
hinted at with a control that would fail. The other seven pipeline stages are
somebody else's work.

### Trade inference, and the bank/queue split · BUILT 2026-09-03

`scripts/check-trade-inference.mjs` — 154 assertions, 35 mutations tested, all
35 caught — is in `check:all`.

**Two things that were one condition are now two.** `planIngest` used to skip a
business whose category mapped to no FieldQuo trade. Its comment defended that
correctly and was defending the wrong scope: "a single-trade queue is the whole
point of the campaign, and one roofer in a painting queue is what makes a rep
stop trusting it" is a statement about what a rep may be HANDED, not about what
FieldQuo may KNOW. A trade-less business is now WRITTEN, with `tradeKey: null`,
at `status: discovered` — the bank. It reaches no rep because
`claimCandidateWhere()` filters on an exact trade key and substitutes
`__none__` when handed nothing. The check proves BOTH halves, because either
alone is a bug. A business mapping to a DIFFERENT trade is still skipped
outright and that was deliberately not touched.

**`ProspectCampaign.bankedCount` is new and is a SUBSET of `unmappedCount`**,
not a stage. `found = unmapped + duplicates + rejected + needsReview +
accepted` is unchanged, and `campaignProgress` still measures a target against
`acceptedCount` — otherwise a campaign for 1,000 painters would report itself
finished having produced no painter. The funnel line reads "Kept without a
trade", because "the trade map has a gap and we kept 54,000 licence-holders"
and "we threw 54,000 rows away" are different outcomes that one number cannot
tell apart.

**`lib/sales/intel/tradeDetect.js` reads the trade off the business's own
site**, inside `ANALYZE_CAPABILITIES` and therefore on the `local` lane. No
model is called: a title, a schema.org `@type`, a service-page URL and a nav
label are what §58 means by deterministic.

- **Three-valued, and the scale is not invented here.** It falls out of
  `confidence.js`: confirmed ⇔ `verifying === true || sampleSize >= 2`, weak ⇔
  one soft signal (its own `single_soft_signal` reason), unknown ⇔ nothing.
  `usable()` already dedupes by signal name, so nine nav links saying "Roofing"
  are one `detection.link`.
- **Prose can never manufacture a trade.** The DECISION is computed from
  structural signals only — schema.org, title/meta, URL, nav label. A roofer's
  page saying "we also do siding" produces a roofing candidate and no siding
  one. Body text is recorded and raises the reported confidence of a trade
  already established; it can neither create a candidate nor break a tie.
- **Multi-trade resolves by MARGIN, and a tie is a named state.** The leader
  takes the prospect only if it beats the runner-up on the strongest evidence
  class present. A tie writes `ProspectInference { kind: "trade", value:
  "MULTI_TRADE" }` and NO `tradeKey`. Stated cost: a genuine roofing-and-siding
  firm giving both equal billing stays out of both queues.
- **`Prospect.tradeKey` is FILLED, never overwritten**, guarded on the value
  read (`updateMany where tradeKey: null`). Changing it would move a prospect
  between queues, possibly out from under the rep holding it. A site that
  disagrees with the directory is reported in the task note and left alone.
- **French is not optional.** The source that motivated this is Quebec's. A
  Montreal roofer's site says *couvreur* and *toiture* and never says
  "roofing"; accents are folded on both sides.
- **Only eight schema.org types exist for this**, and they are every subtype
  schema.org publishes under `HomeAndConstructionBusiness`. `MovingCompany` is
  the ninth and is deliberately absent — FieldQuo sells no moving trade.
  Nothing was invented: a hand-typed `SidingContractor` would match zero pages
  for ever, which is trades.js's recorded failure arriving in a new file.
- **The supplier veto is NARROW, on classify.js's measured lesson.** Only a
  schema.org Store subtype or a distributor word in the site's own title
  decides. A shopping cart does NOT, because a fence company that sells panels
  online is exactly the contractor classify.js's 73% first version threw away.

**Measured on a 15-site sample: 10 resolved, 5 deliberately did not** — a paint
distributor, an equal-billing roofing-and-siding firm, a generic "Groupe
Bertrand inc." with no trade word in its structure, a site with one structural
signal only, and a site that would not load.

**RBQ is still `ok: false`, and the refusal now says something true.** Half its
old premise died with this change (rows are no longer skipped). The half that
did not: **the register carries no website column at all** — `licence.js` ships
`websites: []` — so `routeAfterEnrich` sends every RBQ prospect straight past
the crawler and the detector never gets a page to read. Starting an RBQ
campaign today would bank 54,264 licences that nothing built here can ever make
callable. **That is an open product decision and was NOT taken:** the register
carries an email on 87.0% of licences, and a registrable domain derived from
`Courriel` minus the free-mail providers would give the crawler something to
fetch — but a wrong domain puts a rep on a call opening with the wrong trade,
so it needs the owner's yes and its own measurement.

**Two checks were proving the wrong behaviour and were inverted**, the fifth
and sixth time in this project. `check-sales-discovery.mjs` asserted the
unmapped row was skipped; `check-rbq-provider.mjs` asserted an RBQ business was
skipped and "no prospect is written". Both encoded the bug.

### Banking every trade · BUILT 2026-09-03 · NEEDS `prisma db push`

`scripts/check-bank-all-trades.mjs` — 123 assertions, 12 mutations tested, all
12 caught — is in `check:all`.

The owner's ask: *"extract leads of all the contractors. doesn't matter
painter, roofer, hvac, plumber, electricians, paving, asphalt, flooring,
drywall, insulation — all of them."* That is a statement about the BANK. The
single-trade rule is a statement about the QUEUE, it is still true, and nothing
below weakens it.

**`ProspectCampaign.allTrades Boolean @default(false)` is new and is NOT
pushed** — the owner owns the schema. Until `npx prisma db push` runs, ticking
the new box on the campaign form fails at the write. A boolean rather than
"tradeKey null means all trades", because absence is not a statement: a row
nobody finished configuring and a row that deliberately means every trade want
opposite behaviour, and the unsafe reading of one nullable column banks a
province by accident. `lib/sales/discovery/trades.js`'s `campaignTradeScope()`
is the ONE place the two columns become one answer; `neither` is its own state
and `runDiscoverBusinesses` refuses it terminally.

**Where an other-trade row lands in the funnel: `accepted`, with its own trade
key.** Not `banked`. `bankedCount` still means exactly "kept without a trade" —
the row nobody can call. A roofer banked by an all-trades campaign is a real
prospect with `tradeKey: "roofing"`, and `found = unmapped + duplicates +
rejected + needsReview + accepted` is unchanged in both modes. `planIngest`
needed no new branch: its skip was already conditional on the campaign naming a
trade, and an all-trades campaign names none.

**Queue safety is the assertion everything else rests on, and it is proved by
execution**: the shipped ingest writes a page of five trades into a store, and
`claimCandidateWhere()` is then run against the rows it actually wrote, for
every shipped trade. No trade's queue contains a row of another trade; the
trade-less bank row is in no queue at all. Mutating the claim query to drop its
trade filter, or to pass a missing key through instead of the `__none__`
sentinel, fails the check.

**Promotion was NOT safe and is now gated — this was the real risk.**
`promoteToResearch` promoted every row a campaign held at `discovered`, bounded
only by the page size, so a bank-everything campaign would have queued an
ENRICH task per row and each routes onward to a crawl. At ~3,600 tasks/day and
~7 tasks per prospect, the RBQ's 54,264 rows would be 105 days of the entire
platform's pipeline, started by one Start button. Promotion is now bounded by
`targetCount` — the number a human typed — counted from `SalesPipelineTask`
rather than trusted from a payload, with rows that HAVE a trade promoted first
so a trade-less register import cannot starve the trade the campaign asked for.
Banking stays unbounded. The campaign screen shows "N of T queued for research"
and says when the budget is spent, and the task note says it too.

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
- **`TechnologySignature` had no consumer at all** — no detector, no crawler.
  The screen carried a permanent banner saying nothing read `patterns`, and
  validated shape only. **Superseded 2026-09-02: it has a consumer now.** See
  "Fingerprinting and capability detection" below; the banner has come down and
  what replaced it is computed from the database rather than hard-coded.

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

### Fingerprinting and capability detection — BUILT (2026-09-02)

`TechnologySignature` has a consumer. `lib/sales/intel/technology.js` matches
its `patterns` deterministically (§58 — a model guessing at a competitor would
be confidently wrong in a sales conversation), and two pipeline stages,
`DETECT_TECHNOLOGY` and `ANALYZE_CAPABILITIES`, write `ProspectTechnology` and
`ProspectCapability` from what it finds. `scripts/check-sales-fingerprint.mjs`
executes it: 280 assertions, 31 mutations tested, all 31 caught.

**The null-versus-false rule, in one sentence.** A capability is `false` only
when at least one page actually rendered, no page in the crawl was blocked or
errored, the crawl did not say of itself that it was incomplete, and — for a
capability whose signal lives beyond the front page — the crawler visited more
than the front page; everything else is `null`. One function,
`absenceEligibility()`, decides it and nothing else may.

Three corollaries that are easy to get wrong and are executed rather than
assumed:

- **A 200 with a body and no links is not a rendered page.** That is the
  fingerprint of a JavaScript-rendered site handed to a crawler that does not
  execute JavaScript, and reading it as "nothing on offer" is a false absence
  arriving through a different door.
- **A null never overwrites a known value.** "We could not look today" must not
  erase "we looked last week and there was a booking page." A `false` and a
  `true` do overwrite, because both are real new observations.
- **A website that will not load is not a business without a website.** That
  inversion is the most damaging one available, because NO_WEBSITE is the
  highest-priority non-competitor rule there is.

**19 starter signatures, and the standard they were held to.** Nothing was
typed from memory: a wrong Jobber detection puts a false claim in a rep's
script and the contractor knows which software they pay for. Each row carries a
`sourced` note saying how it was confirmed — the vendor's own code, a live
fetch of the endpoint, markup found on a real third-party site, or two
independent open fingerprint databases agreeing.

- **Verified and active (16).** Jobber, Housecall Pro, ServiceTitan, Workiz and
  Markate as COMPETITORS; Calendly, Acuity, Podium, Birdeye, Tawk.to, Intercom,
  the Facebook chat plugin, Stripe, Square, Wix, Squarespace, GoDaddy and
  WordPress as adjacent.
- **Shipped INACTIVE (3), with the reason on the row.** Joist has no
  customer-facing website embed at all — nothing for a crawler to see. Thumbtack
  and Angi publish no first-party widget; every "Thumbtack reviews widget" on
  offer is a third-party scraper, so a script pattern would fingerprint the
  scraper rather than Thumbtack.

**A website builder is NOT a competitor.** Marking Wix as one would make
`evaluateRule` refuse every table-stakes capability for a contractor whose site
is on Wix — deleting every real talking point they have. `isCompetitor` answers
one question: does this product do FieldQuo's job (quote, schedule, invoice,
get paid)?

**Loose patterns cannot produce a detection alone.** `html` and `text` are
substring matches over a page's own words, and a blog post titled "why we left
Jobber" contains the string. A signature matched only on loose kinds is capped
below the detection threshold — the same shape as `confidence.js`'s
FUZZY_CEILING. The stated cost: a "Powered by Markate" footer with no Markate
script produces no detection.

**Two corrections to shipped work.**

1. `PROVIDER_BY_KIND.ANALYZE_CAPABILITIES` was `openai`. The stage calls no
   model, so it charged the tightest budget in the pipeline — the lane this
   file's own arithmetic identifies as what makes a 1,000-prospect campaign
   take two days — to protect a vendor it never talks to. Now `local`.
2. `check-sales-rule-admin.mjs` asserted that the signatures route hard-coded
   `detectionsPending: true` and that the screen said "Nothing reads these
   patterns yet". Both became false the moment a detector shipped, so the check
   was proving the wrong behaviour. Inverted, and strengthened: the banner must
   now be COMPUTED (from a count of prospects with a `lastCrawledAt`) rather
   than asserted, because a hard-coded claim about the world is exactly what
   went stale.

**Where the brief was wrong, and what was built instead.** It named twelve
capability codes; the vocabulary is `OBSERVABLE_CAPABILITY_CODES` in
`capabilities.js`, declared on the READING side so a rule cannot condition on a
code no detector emits. `EMAIL_ONLY_CONTACT` is not a code — "only" is composed
by a rule out of `EMAIL_CONTACT` true and `LEAD_CAPTURE_FORM` false, which is
how `rules.js` already spells it. `CONTACT_FORM` and `QUOTE_REQUEST_FORM` are
one code, `LEAD_CAPTURE_FORM`, because no rule distinguishes them and a
detector cannot honestly tell them apart. `FINANCING` and `SMS_CONTACT` have no
code and are NOT emitted: a row nothing reads is the first recurring failure
class.

**Still open.** `cookie` patterns are matched correctly and the current crawler
captures no cookies, so they are inert until it does. Detector thresholds
(`DETECTION_THRESHOLD`, `LOOSE_CEILING`, `MIN_PAGES_FOR_DEEP`) are constants
rather than superadmin settings — the same position `confidence.js`'s
`MATCH_THRESHOLD` and `FUZZY_CEILING` hold, which standing rule 1 has so far
accepted. If the owner wants them on a screen, that is a small build.

### The five gaps the owner found on the rep screen · BUILT 2026-09-02

He added a rep and asked, verbatim: *"asks me for a name email and code? what
is the code for? where do i enter their work email? where can i assign them a
number for callbacks etc? where do i see the sales KPIs? and insights.. and the
AI and the leads?"* Every one was real. `scripts/check-sales-admin.mjs` — 218
checks, 34 mutations tested, all caught — is in `check:all`.

**The worst of them was a column with no writer AND no reader.**
`SalesRep.workEmail` is documented at length as the mailbox a rep sends from,
with an explicit "there is deliberately no fallback to `email`". Nothing in the
console could set it, and `lib/sales/outreachSender.js` was reading `rep.email`
anyway — so the rule was written down in three places and enforced in none, and
a rep whose login is a personal Gmail would have sent cold outreach from it and
collected the replies there. Both halves are wired now: the console assigns it,
`outreachStatus()` blocks every send without one under its own blocker code
(`no_work_mailbox`, not the vaguer `rep_email_invalid`), and the From, Reply-To,
CASL footer and stored copy all address from it. The inbound echo check in
`outreachInbound.js` moved with it — matching only the login address would have
silently reopened the double-filing bug that check exists to close.

**The code is generated, shown, and overridable.** It was a bare text field with
no explanation, which is how two reps end up sharing a slug and one rep's link
credits the other. `lib/sales/repAdmin.js`'s `codeCandidates()` is used by BOTH
the screen (to prefill) and the create route (to retry past a unique-constraint
collision), so the value shown and the value stored cannot diverge. It is fixed
after creation, deliberately: the link is on a card by then, and an edit whose
real effect is "quietly stop some of your signups counting" is a destructive
operation labelled as cosmetic.

**Numbers: one honest answer and one honest refusal.** Texting the signup link
is real and SHARED — `salesSmsNumber()` is `findFirst({ purpose: "sales" })`,
one first-party number for the whole operation, and that is the compliance
posture rather than an omission: a STOP there stops every rep at once. A per-rep
voice callback number is NOT built and no picker is rendered for it:
`FIELDQUO_SALES_NUMBER` is one env var naming FieldQuo's own line, and no model
links a phone number to a rep. `NUMBER_CAPABILITIES` says both on screen.

**`/platform/sales/performance` is the first sales dashboard.** Signups per rep
(today / this week / period / lifetime, UTC Monday weeks via the rep portal's
own `bucketSignups`), milestones reached, commission earned vs reversed vs paid
vs owed, the acquisition funnel, the leads pipeline, and every attributed
company with what it is doing now. Ranked by signups this week — not commission
(it lags sixty days and answers a finance question), not lifetime totals (a rep
hired in March outranks everyone forever), not conversion rate (most reps sit
under the floor and sorting by nulls sorts by nothing).

**Three honesty properties it holds, each mutation-tested:**

- **No percentage below `RATE_FLOOR`**, imported from `lib/analytics/kpis.js`
  rather than restated. Below ten outcomes the screen prints "3 of 4" and how
  many more are needed. The page does no division of its own — the check
  asserts there is no `* 100` in it.
- **A figure that cannot be computed is `NOT_TRACKED` with the missing input
  named**, never a zero. Cost per acquisition (nothing holds what a rep costs —
  a commission plan is per-sale, not salary), calls and talk time (there is no
  human calling path; Twilio Voice does not exist in this repo), time to close
  (`SalesLead.createdAt` is when a rep typed it in, so the metric would improve
  when reps got slower at paperwork), pipeline value (a lead carries no deal
  size and inventing one is what §18 rules out).
- **Commission is summed from the ledger, reversals included.**
  `SalesPayoutBatch.totalCentsAtClose` is never read, per its own schema
  comment; the check asserts the string does not appear in the module.

**A distortion found while building it, and reported rather than smoothed
over.** `earnMilestone()` writes nothing at all for a rep with no commission
plan — correctly, since paying an invented figure is worse than paying late —
so every company that rep brought in is invisible to the ledger-sourced funnel
stages. The funnel counts those stages anyway and carries the caveat with the
number of blind companies. Activation does not have the problem: it is read off
`Company.stripeChargesEnabled`, the same predicate `qualifiesForActivation()`
uses, and is a fact rather than a ledger row.

**Where this brief was wrong.** It said `resolveSendingIdentity` in
`lib/sales/outreachIdentity.js` already blocked sending. That function has no
caller anywhere in `app/` or `lib/` — only its own check script imports it — so
it blocked nothing. Worse, it and the shipped sender disagree about the From
address: `outreachIdentity.js` (and this file, above) say From is a derived
address on the verified sending subdomain with Reply-To pointing at the rep's
real mailbox, while `outreachSender.js` sends From the mailbox directly and
therefore needs the ROOT domain verified. **That is an open product decision and
was NOT resolved here** — the minimal change was made instead (the sender now
reads `workEmail` rather than `email`), which makes the console's statement
true without picking a side on the addressing architecture. Somebody has to
choose, and choosing changes what DNS has to be verified before a rep can send.

**Still open.** The rep-facing dashboard (a rep seeing their own numbers) is a
separate job — `/api/sales/me` already returns link and counts, and nothing
renders a scoreboard from them. A rep's own commission balance is likewise not
on any screen they can reach.

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

### MARKET SIZE — measured, then corrected upward 48%

**775,628 field-service businesses** across Canada and the US with a findable
location. 79,736 CA + 695,892 US, 99% with a phone.

| | Canada | USA |
|---|---:|---:|
| All businesses in the dataset | 1,561,927 | 16,194,652 |
| **Field-service addressable** | **79,736** | **695,892** |

**The first number I produced was 522,123 and it was wrong, by my own error.**
I hand-typed category keys from memory instead of reading Overture's 2,118-row
taxonomy. Four of them — `pest_control`, `garage_door_services`,
`window_installation`, `flooring_contractors` — **do not exist and silently
matched zero rows**. Whole categories were missed outright:
`construction_services` (62,584), `countertop_installation` (16,231),
`masonry_concrete` (11,703), `builders` (11,266), `handyman` (7,571),
`paving_contractor` (7,545), plus appliance repair, carpet cleaning, pool
cleaning and fencing.

The owner caught it with a Fermi check rather than a query: Jobber alone claims
200,000+ home-service pros, so a 522K universe would give one vendor a quarter
of the market. **A category key that matches nothing looks exactly like a
category with no businesses in it.** Anything selecting from this taxonomy must
be generated from the taxonomy file, never typed.

**775,628 is NOT the market. It is roughly 19% of it, and calling it the
market was a category error — a worse mistake than the 522,123 arithmetic.**

The owner supplied the government counts. Overture is a *lead-discovery
source*; the official registers are the denominator, and they are five times
larger:

| NAICS 23, Construction | Employers | Non-employers | Total |
|---|---:|---:|---:|
| Canada (ISED / StatCan, 2025) | 159,514 | 255,892 | **415,406** |
| USA (Census CBP + NES, 2023) | 814,557 | ~2,875,590 | **~3.73 M** |
| **Combined** | ~974,000 | ~3.16 M | **~4.12 M** |

Our own Overture figure against that: **79,736 of 415,406 in Canada — 19.2%**.
The US ratio is the same shape. So the coverage gap is not a tuning problem and
no amount of taxonomy fixing closes it.

**And 4.12 M is itself conservative for FieldQuo**, because NAICS 23 excludes
trades this product explicitly serves: landscaping and lawn care (Canada's
NAICS 5617 adds 76,839 on its own; US landscaping employers alone are 117,969),
snow and ice removal, janitorial, pressure washing, pest control (NAICS 561710),
pool maintenance, appliance repair, locksmiths, tree care.

**Why Overture misses four in five.** It indexes businesses with a findable
POI. A contractor who works from home, hides their address, has no storefront,
operates through Facebook only, or is incorporated under a name different from
the one on the van is registered with a government and invisible to a map.
Roughly three-quarters of US construction establishments have no payroll at all.

### The correct framing, and the counts to keep separate

Never report one number. Track:

- **Government-known** — the ~4.12 M above. The denominator.
- **Discoverable online** — 775,628 today, from Overture.
- **Contactable** — has a phone, site or email.
- **Verified active** — licence current, or recent permit activity.
- **Qualified prospects** — what a campaign has actually worked.

`Prospect.status` already carries the last three distinctions. What was wrong
was the vocabulary above it, not the schema.

### The multi-source registry this implies — owner's plan, recorded

One identity spine, many evidence layers, nothing destructively merged:

| Layer | Source | Contributes |
|---|---|---|
| Spine | Overture Places (CDLA-permissive, bulk) | name, category, address, coords, sometimes phone/site |
| Canada expansion | StatCan **ODBus** (~450k records, Open Government Licence) | name, address, NAICS, licence number and type, status |
| Licences | Provincial/state/municipal boards — Quebec **RBQ** publishes a daily bulk CSV (~54k active); California **CSLB**, Florida DBPR, Texas TDLR, Arizona ROC | legal name, trade class, licence status, expiry — often better than a map pin |
| Work evidence | Municipal permit data | proves a business is trading, not merely registered |
| Legal identity | OpenCorporates (140+ registries) | entity behind a trade name, jurisdiction, status |
| Paid accelerator | Data Axle (~1.1 M CA, ~13–18 M US locations) | phone, site, size — evaluate on a 10–20 region sample BEFORE buying, and only with a licence that permits storage and prospecting |
| Enrichment | The business's own website | email, services, service area, booking URL |
| Verification | Google Places, **on demand only** | current status, hours, rating |

**Google is an enricher, never the census, and this is a licensing constraint
rather than a preference.** Text Search returns 20 per page and about 60 with
pagination, capped at a 50 km radius; Google does not permit building a rival
directory from Places content. The **Place ID may be stored indefinitely** —
other fields may not. So: match a business from a source we own, keep its Place
ID, and fetch live details at the moment a rep opens the record.

**Store source, licence, retrieval time and confidence per FIELD**, and never
let a website overwrite a government record. One canonical business, many
source rows beneath it.

Highest-yield next step is licence bulk files — Quebec RBQ, California CSLB,
Florida DBPR, Texas TDLR — not another Places sweep. They add firms that never
appear as a clean POI, and they carry trade class from an official codebook
rather than from Overture's taxonomy.

### The architectural consequence of a bank this size

Ingesting is cheap; enriching is not. At ~3,600 tasks/day and ~7 tasks per
fully-researched prospect, 775K prospects is ~1,500 days. So the design
separates **the bank** (large, cheap, name/phone/address/category/website only)
from **the worked set** (what a campaign promotes into crawling and analysis —
hundreds or low thousands). `Prospect.status` already carries that distinction,
which is why a row can sit at `discovered` indefinitely at almost no cost.

### MEASURED — the fill rates are real, and they are good

Done for $0 in about sixty seconds. No 9.76 GiB download: a bbox predicate
prunes row groups and skipping geometry cuts the payload, so one filtered scan
over the remote Parquet produced a 32 MB local file. Release `2026-08-19.0`.

| | Ontario | New York |
|---|---:|---:|
| Businesses across 9 trades | 10,934 | 10,588 |
| **% with a phone** | **99.6** | **99.6** |
| **% phone AND street address** | **96.1** | **97.2** |
| % with a website | 92.7 | 91.4 |
| % with an email | 49.0 | 48.1 |
| **Cold-callable records** | **10,512** | **10,290** |

New York was chosen because it borders Ontario at a comparable population, so
the counts compare directly. **The two regions agreeing to within a point on
every metric is the strongest available evidence that these are properties of
the dataset rather than one region's sourcing.**

A 1,000-business pull yields ~996 with a phone and ~961 cold-callable. Email is
the only genuinely half-empty field, and it is bimodal — 0.0% for cabinet
businesses in both regions.

**Ottawa: 70 painting contractors in the city, 69 with a phone** (91 and 88
counting alternate categories). Across all trades the Ottawa area has 2,802
callable records.

### Three findings that contradict the obvious reading

- **`confidence` is near-useless here.** 98.9% phone fill in the LOWEST bucket
  against 100.0% in the highest, and it is a per-source constant — Foursquare
  emits 3 distinct values across 2,279 rows. Do not filter on it.
- **There is no closed flag.** `operating_status` is only ever `open` or NULL;
  Overture does not inherit Foursquare's `date_closed`.
- **45% of phones are bare digits, 54% E.164.** Normalisation is real ingest
  work, not an afterthought.

### The $150 should not be spent

Both vendors run record counts **free before purchase**, and Data Axle
Reference Solutions is **free with a public library card** (1.5M Canadian
companies). The benchmark the audit wanted to buy is already available at zero
cost. Neither vendor publishes field-level fill rates — LeadsPlease's "98%" is
postal deliverability, not fill.

The audit's own pricing was also corrected: its LeadsPlease figure quoted the
EMAIL list. The mailing list, the one carrying the phone number, is 9–25¢, so
50,000 is about $4,500 rather than $12,000 — overstated 2.7×.

### The question that replaces it: enumeration DEPTH

Fill rate is answered. What is not is whether 70–91 painters is most of
Ottawa's painters. Coverage is internally consistent across Ontario cities
(painting runs 2–4.6% of home-service everywhere), but no external denominator
was obtainable. **StatCan table 33-10-0661 is the right source and nobody has
checked it yet.**

That is now the only open question about the discovery source, and it is a
counting exercise rather than a design decision.

### Superseded — the gap this replaces

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
The schema is deliberately neutral: `ProspectCampaign.discoverySources` has
NO default and starts EMPTY, so a campaign must name its sources rather than
inherit the one that cannot legally serve it.

A campaign names several sources at once, per the owner's rule that "where the
business comes from should be a checkbox to allow multiple sources, not one or
the other". That makes the licence question plural rather than singular:
ticking three boxes takes on three sets of terms, so every registered source
must state its own licence (registration throws otherwise) and each checkbox
renders it. The same painter arriving from two sources is FLAGGED, never
merged — a source record id cannot match across providers, so the match falls
to the fuzzy tail, which is wrong 52.5% of the time it fires.

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

---

## QUEUED — record when billing actually started

Owner, 2026-09-02: *"we should know when the billing start… nobody ever cleared
[trialEndsAt] when billing started."*

He is right, and it is the bug that made my own "6 companies on trial" wrong:
one of those six is a PAYING company still carrying a `trialEndsAt` nobody
ever superseded.

**`Subscription` today records:**

| column | means |
|---|---|
| `createdAt` | the row was written — that is `checkout.session.completed`, i.e. TRIAL START |
| `trialEndsAt` | when the trial was SCHEDULED to end |
| `status` | Stripe's current word for it |
| `currentPeriodEnd` | the end of the period being billed now |

**Nothing records the moment billing began.** So "when did this customer start
paying us?" cannot be answered from the subscription row at all.

**The fix, and why it is not "clear trialEndsAt":** clearing destroys the record
of when the trial was meant to end, which is evidence in any argument about a
charge. Add `Subscription.billingStartedAt`, stamped at the same instant
milestone 2 fires — `invoice.payment_succeeded` with
`billing_reason: "subscription_create"` AND `amount_paid > 0`, which is already
the one moment the codebase agrees means "the first real money arrived"
(`lib/sales/commission.js`). Stamp from Stripe's own timestamp, never
`new Date()`, so a replayed webhook cannot move it.

Then:

- "on trial" becomes `billingStartedAt == null`, which needs no interpretation.
- "when did they start paying" is answerable for every company, not only the
  ones a rep is attributed to.
- `trialEndsAt` keeps meaning what it always meant.

**Blocked, not forgotten:** `prisma/schema.prisma` is currently held by two
concurrent agents and is temporarily invalid in the working tree —
`notificationDeliveries` appears twice on `Company` and `RecordEdit` has no
opposite relation. Adding a third change under them is how the merges went
wrong earlier today. This lands once the tree settles.

---

## Sales enablement documents — BUILT 2026-09-03

Three documents in `docs/sales/`, grounded in code rather than in what a SaaS
deck usually says. Nothing was asserted that could not be traced to a file.

| File | What it is |
|---|---|
| `docs/sales/SOP.md` | How a rep works a lead end to end, using only controls that exist |
| `docs/sales/ONBOARDING-AND-COMP.md` | Hiring, the three milestones, and worked examples |
| `docs/sales/FEATURES.md` | All 76 features, the 9 limits, the 12 exclusions, the competitors |

**The compensation examples were computed by executing `lib/sales/commission.js`
and `lib/sales/payouts.js`**, not by reasoning about them — including the
boundary cases (an entry at exactly the window end is excluded by the half-open
range; a reversal nets against the same week).

### Findings worth acting on

1. **The calling window is not enforced.** `withinSalesCallingHours` has no
   production caller — grep finds only `scripts/check-sales-suppression.mjs`.
   The queue's dial control is a bare `tel:` link with no window check. The SMS
   window IS enforced. Until this is wired, the rep obeys 09:00–21:30 / 10:00–
   18:00 by hand, and the SOP says so in a warning box.
2. **The playbook is unreachable by the people it was written for.** Nine call
   stages and eight objection responses exist; every consumer is a `/platform`
   screen. `grep -rn playbook app/sales/` is empty.
3. **`SalesCommissionPlan.retentionDays`'s doc comment is wrong.** It says
   "Days after the first successful payment"; the code anchors on subscription
   start, which is precisely the bug `qualifiesForRetention()` records fixing.
4. **`feature.languages.limits` is now stale.** `app/i18n/featurePages/` gained
   `de`, `zh` and `it`, and the limit sentence still names only Spanish,
   Ukrainian, Punjabi and Tagalog as pending — so it understates how much is
   unreleased. Owned by the i18n agent; not touched here.
5. **The "eight sentences" comment is wrong in two files.** There are nine
   `feature.*.limits`. `app/i18n/featurePages/index.js` and `en.js` both say
   eight. Not touched here.
6. **The compare pages expire on 2026-11-27.** `STALE_AFTER_DAYS = 90` against
   2026-08-28 reads. Jobber's promo already expired 2026-08-31.
7. **The "They start cheaper than we do" panel fires on the Housecall Pro page
   too**, but the surrounding copy reads as though QuoteIQ is the only one.

### Screenshots — NOT produced, and why

`app/components/layout/MobileTabBar.js:96` has a code comment containing the
a literal `pb-` arbitrary-value class with an ellipsis inside. Tailwind v4 scans comments, emits
an invalid `padding-bottom` declaration, PostCSS fails, and **every route returns 500** — `/`,
`/features`, `/pricing`, `/compare` all confirmed. Almost certainly a
production build blocker too. The sibling `pb-[calc(4rem+...)]` reference has
the same defect. Not fixed here: that file is another agent's live work.

Separately, `/app`, `/platform` and `/sales` all 307 to their login pages and no
credentials were entered. `FEATURES.md` carries the deck structure with 14
placeholders naming the exact route and both viewports (1440×900 and 375×812).

**Blocked, as instructed:** the PDF export and the resource-section UI were not
built — the PDF renderer cannot draw Cyrillic yet, which also blocks the
Ukrainian and Russian versions. Translations were not attempted.

---

## Sales call handling — BUILT 2026-09-03

Full design and the reasoning behind every decision:
**`docs/sales-intel/CALL-HANDLING.md`**. Read that rather than this summary if
you are about to change any of it.

A dial produced no record at all before this. The Oklahoma and Florida
three-per-24-hours caps were reported to the rep as `unenforced` on screen
because nothing counted attempts. That is now the only thing standing between
the gate and enforcing them: `attemptsLast24h` is wired and passed, and it
returns `null` — never zero — while the table is absent.

### What landed

| Thing | State |
|---|---|
| Disposition vocabulary, ten outcomes, each with its claim transition | done |
| Attempt recorded at the DIAL, not at the outcome — the cap counts calls | done |
| Cap counted by NUMBER, not by prospect (dedupe flags, never merges) | done |
| do-not-call writes `SalesSuppression` in the same transaction, phone channel only | done |
| Agent state: off / available / on a call / writing up / paused-with-reason | done |
| Presence goes STALE rather than staying true when a laptop closes | done |
| In-browser calling — token, TwiML bridge, status callback, live timer, mute | done |
| Local caller ID from numbers FieldQuo owns; no path constructs one | done |
| Superadmin floor board, `/platform/sales/floor`, 15s refresh | done |
| Three-tier scope computed ONCE (`lib/sales/team.js`) | done |
| Progressive/predictive dialling built, named, refused behind two switches | done |
| `check:sales-call-handling` in `check:all` — 264 assertions | done |
| 24 mutations, each confirmed applied, all caught | done |

### The schema is HANDED OVER, not pushed

`lib/sales/calls/schema.pending.prisma` — two models
(`SalesCallAttempt`, `SalesRepActivity`), `SalesRep.managerId`, four columns on
`PlatformVoiceCall`, one on `PlatformSmsNumber`. `lib/sales/calls/store.js`
probes the generated client, so every control turns itself on the day they
land and stays honestly absent until then. Same pattern as
`lib/sales/playbook/store.js`.

When they land, `check-sales-calling-window.mjs`'s `SalesCallAttempt` tripwire
flips — that is what it is for, and its replacement assertion is already
written.

### Three env vars

`TWILIO_SALES_TWIML_APP_SID` (browser calling; note an access token needs the
API KEY pair, not the auth token), `SALES_DIAL_MODE`,
`SALES_AUTOMATED_DIAL_ENABLED`. All in `docs/VERCEL.md`.

### Still open, highest first

1. **An inbound "take me off your list" does not reach `SalesSuppression`.**
   The transcript sits in `PlatformVoiceCall` and nobody acts on it. SMS
   handles STOP; voice does not. This is the one live compliance gap the work
   found.
2. **Suppression is still not consulted at CLAIM time** — `claimCandidateWhere`
   reads `Prospect.doNotContactAt` only. Already on the roadmap; the dial path
   is now guarded, the claim is not.
3. **The team-lead tier is inert.** Written, tested, and refuses everything
   until `SalesRep.managerId` exists and `TEAM_LEAD_NOTE_VISIBILITY_FROM` is
   set. Deliberately not half-built.
4. **Claims that lapse unworked are not counted** — re-claiming overwrites the
   holder. Counting them needs a claim-event log, which is an owner decision.

### The decision the owner should settle

**May a team lead release a stuck claim, and may they hand it to a named rep?**
The design allows release and refuses named transfer, on the grounds that
choosing who gets the conversation is a lever on who gets paid. The honest
counter-argument is that a lead can release it and tell that rep to claim next,
so the refusal may buy nothing. Nothing is built either way. If the answer is
"they may reassign", it needs an audit row — the same reasoning
`SalesPlaybookAssignment.assignedBy` records.
