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

### Phase 1 — still open

- **Blocks reps sending mail** (owner action): verify the reps' root mail
  domain in Resend; set `SALES_MAILING_ADDRESS`; set
  `SALES_REPLY_ADDRESSING` to `plus` or `plain` (no default on purpose — a
  wrong choice bounces replies to the prospect).
- **Does not block sending**: `SALES_INBOUND_SECRET` plus the mailbox
  forwarding rule; without it the portal honestly says replies are not being
  filed.
- **SMS has the same demo hole email had.** `lib/sms/twilioClient.js` has no
  demo guard — referral invite will text a real prospect from a demo account
  today. Named, not built.
- Outreach screens are English-only while the rest of the portal is translated.
- Weekly payout batches: the model exists, the closer does not.
- Rep dashboards, leaderboard, CAC, cohorts, fraud review — Phase 5 of the
  original plan, not started.

---

## Phase 2 — Sales intelligence, prospecting, telephony, copilot

Specified 2026-09-01. The spec's own §64 says to audit before writing code, so
that is what is happening.

**Now:** the compliance audit is still running. A separate agent is fixing four
live voice bugs found during the audits. Nothing of Phase 2 is being built.

### Jobs / AI / data-model audit — DONE (`AUDIT-jobs-ai-model.md`)

**Most of a job queue already exists, split across two files that never met.**
`VoiceCallTask` has the status machine, `notBefore`, `attempts`, `lastError`
and the right index. `lib/voice/autoTopup.js` has the compare-and-set claim,
a stale-claim timeout, and token reuse so a reclaim keeps its idempotency key.
Together that IS the pipeline table — it does not need inventing, it needs
joining up.

**A thousand prospects is about a day**, drained in small batches on the
existing cron cadence. If discovery must finish in an hour, crons are the wrong
substrate and that is a real decision rather than a tuning exercise.

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

### ⛔ BLOCKER — Google Places cannot be the discovery source

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

### The four things that could stop this, in order

1. **Google Places terms and caching.** §19–20 want 1,000 businesses
   discovered, stored and cached as a prospecting database. Google has
   historically restricted caching of Places content, and prohibited using it
   to build a competing database. If that still holds, the discovery source
   has to change, not the caching strategy. Being researched.
2. **Telemarketing law.** Outbound cold calling into Canada and the US needs
   DNC handling, calling-hour rules and caller identification sorted BEFORE
   the first call, not in a compliance pass at the end. Whether B2B is exempt
   is exactly the question being researched.

   **Entity facts, confirmed by the owner 2026-09-01 — these change the
   position and must not be re-guessed:**

   - **The Ukrainian reps are FieldQuo EMPLOYEES.** Not an agency, not
     contractors. So FieldQuo calls on its OWN behalf — first-party. Under
     Canada's Unsolicited Telecommunications Rules the "telemarketer" and the
     "client" are the same entity here, which is a different obligation set
     from an agency dialling for a client.
   - **FieldQuo is a registered entity in BOTH Canada and the USA.**

   What that buys, structurally:

   - **Standing to subscribe to both DNC lists.** A foreign entity with no
     local registration cannot straightforwardly do this. FieldQuo can.
   - **Local numbers are genuinely local.** Carriers commonly require an
     in-country business address to sell local numbers, Canada especially. A
     Canadian-registered FieldQuo holding a 613 number and calling Ottawa
     from it is presenting its own real number in its own country. That was
     always the design — §25 already forbids spoofing — but it is now local
     presence in fact, not a workaround.
   - **One accountable entity.** One registration, one DNC subscription, one
     set of scripts, and employee training that is actually enforceable.

   What it does NOT change: the destination country's rules apply to a call
   placed to a number in that country regardless of where the rep is sitting.
   The rep's location is a carrier-policy and call-quality question, not a
   legal exemption. Being confirmed with sources rather than assumed.

   Adjacent, and NOT a build problem: employing staff in Ukraine through a
   Canadian/US entity raises employer-of-record and permanent-establishment
   questions. Worth an accountant's confirmation; nothing here depends on it.
3. **Twilio's own policy** on area-code-matched caller ID and on a rep placing
   calls from outside North America.
4. **Cost.** Discovery, crawling and AI analysis per prospect, then telephony
   plus transcription plus AI per call. Needs a real number before it runs at
   1,000-prospect scale.

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

## Decisions waiting on the owner (Phase 1)

1. **Can a rep claim a company themselves?** Today every phone-closed deal
   needs a superadmin. Recommendation: rep submits a claim, superadmin
   approves — keeps the property that nobody writes their own ledger.
2. Two reps, one company — split, first touch, or last touch?
3. Flat commission across all four plan tiers?
4. Does a departed rep keep earning the 60-day milestone?
5. How much of a contractor's data may a rep see? (Default today: name,
   signup date, milestone states, subscription status. Nothing else.)
