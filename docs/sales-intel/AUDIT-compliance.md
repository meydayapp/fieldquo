# Phase 2 audit — compliance, consent, and the external terms

Read-only audit. No product code was changed by the session that wrote this.

Scope: the outbound cold-calling operation described in the Phase 2 spec —
FieldQuo-employed reps (some physically in Ukraine) calling painting, HVAC and
plumbing contractors in Canada and the US on local caller IDs, with call
recording, live transcription, AI analysis and cold email; prospect data from
Google Places plus crawling the contractors' own websites.

Two halves: what this repo already does about consent, and what the outside
world requires. The checklist at the end is the operative part.

**Research date: 2026-09-01.** Telemarketing rules in Canada are under active
review right now (Compliance and Enforcement Notice of Consultation CRTC
2026-132) and the FCC has a live proposal about offshore call centres
(NPRM FCC-26-16A1, 27 March 2026). Both are named below. Neither is settled.

I am an engineer reading terms of service and regulators' own pages, not a
lawyer. Where the answer turns on legal judgement rather than on a published
rule, I say so instead of guessing.

---

## The short version

Three findings, in the order they matter.

1. **The Google Places half of the spec cannot be built as described.** Not
   "risky", not "grey" — the current Google Maps Platform Terms of Service name
   the exact operation the spec asks for as an example of prohibited conduct:
   *"copy and save business names, addresses, or user reviews"*
   (§3.2.3(a)(iii)). A second clause bars using the services *"in a listings or
   directory service or to create or augment an advertising product"*
   (§3.2.3(d)(iii)), and a third bars using Maps Content *"to improve machine
   learning and artificial intelligence models"* (§3.2.3(c)(vii)) — which is
   what "AI analysis of the prospect" would be. Place IDs may be stored
   indefinitely and lat/lng for 30 days; nothing else. **The discovery source
   has to change. The caching strategy is not the problem.**

2. **Cold calling is legally available, and cheaper than expected, but it is
   not free of obligation.** In Canada, business-to-business calls are exempt
   from the National DNCL rules — but FieldQuo must still **register** with the
   National DNCL (free), and must still obey the Telemarketing Rules: calling
   hours, identification, and its own internal do-not-call list kept for three
   years. In the US, the FTC's Telemarketing Sales Rule exempts B2B calls
   almost entirely (16 CFR 310.6(b)(7)), so the $23,425/year National DNC
   Registry subscription is very likely unnecessary — but the TCPA's separate
   restriction on prerecorded/artificial-voice and autodialled calls to mobile
   numbers has no B2B exemption, and small contractors answer on mobiles.

3. **This repo has excellent consent machinery and none of it is reusable
   here.** Every consent record in the codebase — `CallConsent`,
   `MarketingSubscriber` — is scoped to a `companyId`, i.e. to a *tenant's*
   relationship with a *homeowner*. FieldQuo's own outbound sales operation is
   a different party talking to a different audience through a different
   channel, and there is **no platform-level suppression list anywhere in the
   product**. The one opt-out mechanism that does exist for sales
   (`leadOptedOut`) is scoped to a single `SalesLead`'s inbound messages, so
   an opt-out reaches neither a second rep's copy of the same prospect nor the
   phone channel at all.

---

# HALF 1 — What the repo already does

## 1. Recording and transcription consent

### What exists

`scripts/check-recording-disclosure.mjs` guards one thing: that the AI
receptionist's prompt tells the caller the call is recorded. It builds the real
prompt via `buildAgentPrompt()` rather than reading the file, so the assertion
survives someone moving the sentence, and it checks all four supported
languages.

The disclosure itself is `lib/voice/prompt.js:93`, rule 4b — said once, early,
in the agent's own words, explicitly not repeated, explicitly not read as a
legal notice. A caller who objects is told plainly it cannot be switched off
and is offered a person or a message instead.

`lib/voice/disclosure.js` holds the four form-side strings (`lead`,
`self_quote`, `booking`, `job_completed`). These are about *being called*, not
about *being recorded* — read them carefully; none of them mentions recording.

`lib/voice/recording.js` is about who may *hear* a recording, not consent:
`callRecordingHref()` (line 37) keeps the provider's unsigned, unexpiring
recording URL server-side, and `CALL_AUDIO_LEVEL` (line 68) gates playback on
`clientsProperties: full_view` rather than `user:manage`, with the reasoning
written out.

### Is it jurisdiction-aware?

**No, and the check script says so in its own header** — that the contractor,
not FieldQuo, is the recording party, that Canadian requirements vary by
province, and that the check asserts only the floor: the caller is told.

That is an honest posture for an inbound receptionist. It does not transfer.
For the outbound sales operation:

- **Canada.** One-party consent under the Criminal Code makes the *recording*
  lawful, but PIPEDA governs it as a commercial activity, and the Office of the
  Privacy Commissioner's guidance (published 2018-03-06) is explicit: inform
  the customer, state the purpose, and **offer an alternative if they object**
  ([OPC, Recording of Customer Telephone
  Calls](https://www.priv.gc.ca/en/privacy-topics/surveillance/02_05_d_14/)).
  A sales call has no "alternative channel" the way a service line does, so in
  practice the alternative is: stop recording, or end the call.
- **US.** Eleven states require all-party consent (California, Delaware,
  Florida, Illinois, Maryland, Massachusetts, Montana, Nevada, New Hampshire,
  Pennsylvania, Washington), with several more unsettled. On an interstate
  call the stricter state's law is generally the one to plan around.

The receptionist's design — announce once, early, and offer a way out — is
close to the right shape already. What it lacks for outbound is (a) a record
that the disclosure was made on *this* call, and (b) any awareness of where the
called party is. Neither exists today.

**Gap named:** there is no per-call record that a recording disclosure was
given, and no jurisdiction map anywhere in the codebase. `VoiceCall` stores
`recordingUrl` and `transcript` with, per the privacy policy, no expiry path at
all.

## 2. Call consent — `CallConsent` and `recordConsent`

`prisma/schema.prisma:7126`. Fields: `companyId`, `e164` (normalised, the
lookup key), `source`, `disclosure` (the exact wording shown, **stored not
referenced**, so the defence is what the person actually saw), the linked
lead/client/quote/job, `note`, and `optedOutAt` (line 7158) which is set on
request and never deleted.

`lib/voice/outbound.js` is the whole gate:

| Line | Thing |
|---|---|
| 33 | `CONSENT_SOURCES` — the five evidenced bases, each with its own expiry (12 months; 3 for `job_completed`; 6 for `manual`) |
| 51 | `CALL_WINDOW` — 9:00–20:00 in the *client's* local day |
| 54 | `withinCallingHours()` — unknown timezone returns **false**, not "probably fine" |
| 75 | `recordConsent()` |
| 95 | `optOut()` — creates a row even when there was no consent to mark, so "don't call me" is recorded from someone we never had permission to call |
| 158 | `consentVerdict()` — pure, executable without a database; opt-out is checked **before** consent |
| 206 | `mayCall()` — two queries plus the verdict |

`scripts/check-lead-consent.mjs` enumerates every route in `app/api` that calls
`leadRequest.create` and fails if any of them skips `recordConsent` — so a new
lead path added later fails the check rather than quietly joining a gap.

`app/api/leads/[id]/route.js:47` derives a `doNotCall` flag from `CallConsent`
rather than storing a column.

### What this is for, and what it is not

The file header states the design intent outright: *"That's the difference
between 'we discourage cold calling' and 'cold calling doesn't work here'."*
A pasted purchased list produces numbers with no consent rows and every one is
refused. What is deliberately not on the consent list: "they're in our
database", "we met them at a trade show".

**This is the single most important structural fact in this audit.** The
product was built so that the thing Phase 2 wants to do is impossible. Every
row is `companyId`-scoped to a tenant. FieldQuo's own sales calls are not a
tenant's calls, so this machinery cannot be reused — and must not be quietly
widened, because `mayCall`'s refusal is the guarantee that protects
contractors from their own purchased lists.

The outbound sales dialler needs its **own** gate, its **own** suppression
table, and its own reasoning. Copying `outbound.js` and dropping the consent
requirement would produce a file that looks like the compliant one and is not —
exactly the failure class AGENTS.md calls out (recurring failure #4).

## 3. Email consent

### The tenant side (mature)

`lib/marketing/unsubscribe.js` carries the commercial-vs-transactional split
in its header, and it is a genuinely careful piece of reasoning:

- **Commercial** (gets the link): marketing campaigns, review requests,
  `job_completed` follow-ups. The argument for review requests being commercial
  rather than transactional is written out — asking a past customer to promote
  the business publicly is outreach on behalf of the business's reputation.
- **Transactional** (must *not* get a link, because a stray unsubscribe invites
  someone to switch off mail they need): quotes, invoices, overdue notices,
  confirmations, password resets, billing notices.

Token construction mirrors `Client.portalToken` — 32 CSPRNG bytes, unique per
row rather than derived, so a leaked secret is bounded to one row.
`applyUnsubscribe()` (line 197) sets `subscribed: false` and never true, sets
`unsubscribedAt` **once**, stores the disclosure text once, and produces no
deletes. `unsubscribeHeaders()` (line 223) emits RFC 8058 one-click headers.

`prisma/schema.prisma:4109` — `MarketingSubscriber`, with
`unsubscribeDisclosure` stored verbatim for the same "the defence is what they
saw" reason as `CallConsent.disclosure`.

`scripts/check-consent-mechanisms.mjs` executes the real template builders with
fixture data and asserts the split holds both ways: every commercial template
contains the link, every transactional one does not. It also mutation-tests
SMS opt-out (`"please stop by at 3"` is not an opt-out; `"STOP"` is) and
asserts every client-facing SMS send path checks the opt-out, not just the one
that already did.

### The sales side (days old, and it named its own gap)

`docs/SALES-OUTREACH.md` plus `lib/sales/outreach*.js`. The approach:

- Mail goes from the **rep's own real mailbox** via Resend, never falling back
  to the platform sender — a "sent" that actually left from
  `quotes@send.fieldquo.com` would put the reply somewhere the rep never looks.
- **Three env vars block sending outright** rather than rendering a compose box
  that would fail: the rep's domain verified in Resend,
  `SALES_REPLY_ADDRESSING`, and `SALES_MAILING_ADDRESS`. `outreachReadiness.js`
  is the single place that decides, asked by both the screens and the send
  route.
- `caslFooterLines()` (`lib/sales/outreach.js:315`) puts sender name, FieldQuo,
  rep email, the mailing address and a reply-to-unsubscribe line on every
  message. There is **no default and no placeholder** for the address — the
  precedent cited is `lib/legal/privacyOfficer.js`: ship the gap visibly rather
  than a plausible fiction, and an email is worse than a web page for a
  placeholder because it has already reached a stranger by the time anyone
  notices.
- `detectOptOut()` (line 446) reads only the first three lines the human
  actually typed, after `visibleReplyText()` strips the quoted original —
  without which every reply would quote our own footer's "unsubscribe" back and
  mark itself an opt-out.
- `leadOptedOut()` (line 481) is **derived from the messages**, not stored on a
  flag, so screen and server cannot drift.
- Nothing sends automatically. No cron, no sequence, no drip.

**The gap it named itself** (docs/SALES-OUTREACH.md §4, "What this does NOT do,
and you should know it"): *consent basis is not recorded per lead.* CASL needs
express or implied consent; the usual basis for B2B cold email is implied
consent from a conspicuously published address relevant to the recipient's role
(s.10(9)(b)). Recording which basis applies to which prospect needs a column on
`SalesLead`, and that change wasn't in scope. So: "reps must only add leads
they have a lawful basis to contact", enforced by nothing.

**Two further gaps I found that the doc does not name:**

- `leadOptedOut` is scoped to **one lead's** inbound messages.
  `prisma/schema.prisma:8086` — `SalesLead` has no unique constraint on
  `email`, only `@@index([salesRepId, status])`. Two reps can each hold the
  same prospect, and an opt-out sent to one does not silence the other. Under
  CASL and CAN-SPAM an opt-out binds **FieldQuo**, not a rep.
- The opt-out is **email-only**. A prospect who says "stop emailing me" is not
  on any list the dialler would consult, because there is no dialler and no
  list.

## 4. Data protection

`lib/legal/processors.js` is the processor register, and it is enforced:
`scripts/check-legal-pages.mjs` walks the real source tree and fails the build
if any entry's `verify` pattern can no longer be found — so a processor cannot
stay in the policy after its integration is gone, and cannot be added to the
product without the same PR touching this file.

Fifteen processors. The one relevant here is `google-maps`, whose role is
recorded as *"Address autocomplete and mapping"* and whose `dataShared` is *"An
address as a homeowner or contractor types it"*. **Prospect discovery is not
that.** Adding Places-based prospecting means a new register entry, a new
privacy-policy paragraph, and a new effective date — and the check will force
that to happen in the same commit.

`lib/legal/privacyOfficer.js` — the Quebec Law 25 designation, filled by the
owner on 2026-09-01: Emilio Boves, CEO, and Person in Charge of the Protection
of Personal Information, contact `819-238-7263`. `PRIVACY_OFFICER_PENDING` is
now `false`, and the check asserts both halves moved together.

`lib/legal/effectiveDates.js` pins the three legal dates as constants
(2026-08-30) rather than `new Date()`.

### The existing posture

`app/(marketing)/privacy/page.js` §1: for homeowner data **the tenant company
is controller and FieldQuo is processor**; FieldQuo is controller only for
information about subscribing companies and their staff.

§5 is unusually honest and it is the paragraph that matters here: *FieldQuo
does not currently delete data on a schedule, and there is no way for a company
to delete its FieldQuo account today.* Call recordings and transcripts have no
automatic expiry. Opt-out records are kept permanently by design. §6: there is
no self-service access, correction, export or deletion for a homeowner.

The privacy page also declines to claim data residency, because nothing in the
codebase pins a region.

### What a prospect database would add

A material change in kind, not degree:

- **FieldQuo becomes the controller** of personal information about people it
  has no relationship with — contractors' names, direct phones, emails, plus
  whatever the AI infers from their websites and, later, recordings and
  transcripts of calls they did not ask for. Every existing "we are the
  processor, ask the company" answer in §6 stops applying to this data.
- It lands on a platform whose own policy says it deletes nothing on a
  schedule and offers no self-service access or erasure. A prospect exercising
  a PIPEDA or Law 25 access request against a database they never opted into is
  a plausible first test of machinery that does not exist.
- **The one real mitigation is genuine and worth knowing about:** PIPEDA does
  not apply to **business contact information** — position/title, work address,
  work phone, work email — collected, used or disclosed **solely** for the
  purpose of communicating with the individual in relation to their employment
  or business ([OPC interpretation
  bulletins](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_02/)).
  "Solely" is load-bearing. A name and a work number used to ring them about
  their business is inside it. **Scoring, enriching, profiling and AI-analysing
  them is arguably outside it**, because that is not "communicating with the
  individual" — and the moment it is outside, full PIPEDA consent obligations
  attach to a database built without consent. This is a legal judgement call
  and should go to counsel with the actual field list in front of them.
- Adding recordings and transcripts of unsolicited sales calls to a store with
  no retention policy compounds §5 rather than sitting beside it.

## 5. Suppression / do-not-contact

**Searched properly** — `suppress`, `do not call`, `dnc`, `blocklist`,
`blacklist`, `denylist`, `stoplist`, `opt.?out` across `lib`, `app`, `prisma`,
`scripts`, `docs`. Everything that exists:

| Mechanism | Where | Scope |
|---|---|---|
| `CallConsent.optedOutAt` | `prisma/schema.prisma:7158`, `lib/voice/outbound.js:95` | one tenant company, one E.164 |
| `MarketingSubscriber.subscribed` | `prisma/schema.prisma:4118` | one tenant company, one email |
| SMS `STOP` | `lib/sms/*`, asserted in `check-consent-mechanisms.mjs` §5 | one tenant company, one number |
| `leadOptedOut()` | `lib/sales/outreach.js:481` | **one `SalesLead`**, email only, derived from that lead's messages |
| `doNotCall` display flag | `app/api/leads/[id]/route.js:47` | derived, tenant-scoped, read-only |

Also found and deliberately excluded: `resendDomains.js:14` refers to Resend's
own account-scoped suppression lists (the vendor's, not ours);
`enforce.js:307`, `copilotTools.js:51`, `jennifer/tools.js:25` use "denylist"
about column redaction; the rest are UI/analytics "suppressed" (hidden
low-sample rows) and `suppressHydrationWarning`.

**Verdict: no platform-level suppression list exists, in any channel.** There
is nothing a FieldQuo sales rep could check before dialling, nothing an opt-out
from any channel could be written to that another channel would read, and
nothing that survives a prospect being re-added by a different rep.

This is the single largest build item on the compliance side, and it is not
optional: Canada's internal do-not-call list obligation (§7 below) applies to
FieldQuo's own B2B calls even though the National DNCL does not.

---

# HALF 2 — The external constraints

## 6. Google Places / Maps Platform terms — **PROHIBITED as specified**

Sources, read directly on 2026-09-01:

- [Google Maps Platform Terms of
  Service](https://cloud.google.com/maps-platform/terms) — **last modified
  August 26, 2026**
- [Google Maps Platform Service Specific
  Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) —
  **last modified June 10, 2026**
- [Places API policies and
  attributions](https://developers.google.com/maps/documentation/places/web-service/policies)
  — last updated 2026-09-01

### The clauses that decide it

**§3.2.3(a) No Scraping.** Customer will not export, extract or otherwise
scrape Google Maps Content for use outside the Services. The listed examples
include *"pre-fetch, index, store, reshare, or rehost Google Maps Content
outside the services"*, bulk download of *"places information"*, and — the
one that ends the argument — *"copy and save business names, addresses, or user
reviews"*.

**§3.2.3(b) No Caching.** No caching except as expressly permitted in the
Service Specific Terms.

**§3.2.3(c) No Creating Content From Google Maps Content**, whose example (vii)
is using Maps Content *"to improve machine learning and artificial intelligence
models, including to train, test, validate or fine-tune the models"*.

**§3.2.3(d) No Re-Creating Google Products or Features**, example (iii): using
the services *"in a listings or directory service or to create or augment an
advertising product"*.

**Service Specific Terms §14 (Places API, Legacy and New)**: §14.1 permits use
without a Google map; §14.2 forbids use *with* a non-Google map; §14.3 permits
temporarily caching **latitude and longitude only**, for up to 30 consecutive
calendar days, after which they must be deleted. Section A's ID Caching clause
permits caching `place_id` indefinitely.

**Consequences of a violation**: §5.1 — Google notifies, and if not corrected
within 24 hours may suspend; §5.2(d) — a §3.2 breach permits *immediate*
suspension. FieldQuo uses Maps for address autocomplete, the mini-map, the
static maps on the marketing designer, distance matrix in
`lib/booking/travel.js`, geocoding and static imagery in
`lib/measure/roofMeasurement.js`, and the Solar API for roof measurement. **A
suspension for prospecting would take the self-serve roofing quote and address
autocomplete down with it.** The blast radius is the product, not the
experiment.

### Plainly

| Spec item | Verdict |
|---|---|
| Discover 1,000 businesses via Places | Permitted as an API call |
| Store their names, addresses, phones | **Prohibited** — §3.2.3(a)(iii) names it |
| Cache results as a prospecting database | **Prohibited** — §3.2.3(b); only `place_id` (forever) and lat/lng (30 days) |
| AI analysis of that content | **Prohibited** — §3.2.3(c)(vii) |
| A prospect list/board built from it | **Prohibited** — §3.2.3(d)(iii), listings/directory or augmenting an advertising product |

There is no configuration, retention period or attribution that fixes this.

### What would have to change

Options, roughly in order of how defensible they are:

1. **Overture Maps places data.** ~59M+ POIs, licensed **CDLA-Permissive
   v2.0** — commercial use permitted, attribution required, no share-alike.
   Bulk downloads. ([Overture attribution
   docs](https://docs.overturemaps.org/attribution/), [Places
   guide](https://docs.overturemaps.org/guides/places/)) This is the closest
   drop-in replacement for "discover businesses in a city by category" that is
   actually licensed for what we want.
2. **OpenStreetMap / Overpass** — free, ODbL. Attribution and share-alike on
   derivative *databases*; thinner and less current on small trades.
3. **A licensed B2B data provider.** Costs money and shifts the licensing
   question onto a contract we can actually sign.
4. **The contractors' own websites**, reached from a permitted directory — see
   §10. Their own published phone and email is the strongest basis for both
   CASL implied consent and the PIPEDA business-contact-information exemption,
   because it is conspicuously published by the business itself.
5. **Keep Places for what it is licensed for.** Storing `place_id` indefinitely
   is expressly permitted, so Places can remain a *verification* step
   ("is this business still listed, is it still open?") queried live at the
   moment of use, without any of its content being written to our database.
   That is a legitimate design; it just is not a prospecting database.

I did not find any Google licensing tier that lifts §3.2.3. If one exists it
would be a negotiated agreement, not a console setting — worth an hour of the
owner's time with a Google Maps Platform sales rep before writing off the
approach entirely, but plan for "no".

## 7. Canada — CRTC, and the first-party position

**Note on sourcing:** `crtc.gc.ca` sits behind a bot-protection challenge that
blocked every automated fetch I attempted, including a real browser. (An
appropriate irony for a document that also assesses crawling.) The findings
below come from CRTC and `lnnte-dncl.gc.ca` pages via search-result extraction
plus the DNCL site directly, and the exact figures should be re-read on the
sites by a human before anyone pays anything. Links are to the pages
themselves.

### Which rules apply to FieldQuo, first-party

The Unsolicited Telecommunications Rules are in four parts. FieldQuo employing
its own reps means "telemarketer" and "client" are the same entity — this
removes the agency-registration complications, and removes nothing else.

- **Part II, National DNCL Rules — do not apply.** *"The National DNCL Rules do
  not apply to telemarketing calls made to businesses."* ([National DNCL
  exemptions](https://lnnte-dncl.gc.ca/en/Organization/Exemptions))
- **Part III, Telemarketing Rules — apply.** These are the ones that matter.
- **Part IV, ADAD Rules — apply** if any automated dialling or announcing
  device is used. Relevant if an AI voice agent ever dials rather than a human.

### Registration vs subscription — the distinction that saves the money

- **Registration is free and mandatory even for exempt callers.** Register at
  [lnnte-dncl.gc.ca](https://lnnte-dncl.gc.ca/). The CRTC's own guidance is
  that telemarketers must register before making unsolicited calls **even if
  the calls being made are exempt** ([CRTC — Telemarketers must
  register](https://crtc.gc.ca/eng/phone/telemarketing/tobligations/register-inscrire.htm)).
- **Subscription is only required for non-exempt calls.** A telemarketer making
  only exempt calls does not have to purchase a subscription. For scale, if it
  ever were needed: as of 15 September 2025 an all-area-code annual
  subscription was **$62,166**, three months all-codes **$17,835**, and a
  50-number pay-per-query **$25** ([CRTC — Telemarketer subscription rates and
  file formats](https://crtc.gc.ca/eng/phone/telemarketing/format.htm)).

So: **register (free, mandatory), and almost certainly do not subscribe.** The
"almost" is the point below.

### What still binds a B2B-only caller

- **Calling hours: 9:00–21:30 weekdays, 10:00–18:00 weekends, in the time zone
  of the person being called.** ([CRTC — Key Unsolicited Telecommunications
  Rules](https://crtc.gc.ca/eng/phone/telemarketing/tobligations/rules-regles.htm))
  Note this repo's existing `CALL_WINDOW` of 9:00–20:00 (`lib/voice/outbound.js:51`)
  is *inside* that on weekdays and outside it on weekend mornings — it starts an
  hour before the weekend 10:00. It is a homeowner-calling window, not a
  business-calling one, and should not be reused unexamined.
- **Identification at the start of the call**: identify the person or
  organisation on whose behalf the call is made, and the purpose. A contact
  telephone number the called party can reach must be provided.
- **An internal do-not-call list**, maintained by the telemarketer calling on
  its own behalf. A request must be honoured, and the name and number kept for
  **three years and fourteen days** from the date of the request. (Market
  research/polling firms are the narrow exception; FieldQuo is not one.)
- The **31-day freshness rule** applies to the DNCL itself and is moot if
  FieldQuo does not subscribe — but the internal list has no such holiday.
- **STIR/SHAKEN** has been a condition of service for Canadian providers of
  IP-based voice since **30 November 2021** ([CRTC news
  release](https://www.canada.ca/en/radio-television-telecommunications/news/2021/11/canadians-to-benefit-from-new-caller-id-technology-to-combat-spoofed-calls.html)).
  This is a carrier obligation, but it is why "local presence" only works with
  numbers you actually own — see §9.
- **Penalties are real and enforced.** Recent CRTC notices of violation are
  published (e.g. `crtc.gc.ca/eng/archive/2026/vt260120.htm`), and a 2016
  settlement across six companies totalled $1.23M.

### Live risk

**Compliance and Enforcement Notice of Consultation CRTC 2026-132** is an open
review of the UTRs; interventions closed 27 July 2026, replies 11 August 2026.
Whatever comes out of it could move the B2B exemption. Worth a calendar
reminder rather than a design decision.

## 8. United States — TCPA and the TSR

### The TSR B2B exemption is broad and explicit

**16 CFR 310.6(b)(7)** exempts *"Telephone calls between a telemarketer and any
business to induce the purchase of goods or services … by the business"*, with
two carve-outs: §310.3(a)(2) and (4) (the misrepresentation and deception
prohibitions — those still apply, always), and calls inducing the retail sale
of **nondurable office or cleaning supplies**. ([eCFR §
310.6](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-310/section-310.6))

FieldQuo sells software to contractors for use in their business. That is
squarely inside the exemption and nowhere near office or cleaning supplies.

**Consequence:** the National Do Not Call Registry's calling-time, caller-ID,
abandoned-call and entity-specific-list requirements under the TSR do not reach
these calls, and the Registry subscription is very likely unnecessary. For
reference if that ever changes: **FY2027 (from 1 October 2026) is $85 per area
code, capped at $23,425 for all area codes**; the first five area codes are
free ([FTC, 2026-08 press
release](https://www.ftc.gov/news-events/news/press-releases/2026/08/ftc-announces-2027-telemarketer-fees-access-national-do-not-call-registry)).

### What the TSR exemption does not cover

- **The TCPA is a separate statute.** Its restriction on **prerecorded or
  artificial-voice** calls and on autodialled calls to **wireless numbers** has
  no B2B equivalent of the TSR exemption. Contractors overwhelmingly publish
  mobile numbers. So: **a human dials, from a list, one at a time.** The
  moment an AI voice agent places the call, or a dialler predicts/auto-dials,
  the analysis changes completely and needs counsel.
- **The Truth in Caller ID Act** prohibits transmitting misleading or
  inaccurate caller ID with intent to defraud, cause harm, or wrongfully obtain
  anything of value. Displaying a real number you own and that rings back is
  the line — see §9.
- **State law.** Several states do not mirror the federal B2B exemption, and
  some have their own registration or bonding requirements for telemarketers.
  I did not audit 50 states and will not guess. If the campaign targets
  specific states, that list needs a lawyer's pass — it is a bounded, cheap
  question once the target states are known.
- **§310.3(a)(2) and (4) still apply**: no misrepresentation about the
  product, price, or the nature of the call. This constrains what a rep — or
  an AI script — is allowed to claim about FieldQuo, and it is the same
  discipline `lib/platform/salesPrompt.js` already imposes on the inbound
  agent.

## 9. Twilio's policy — local presence and a rep outside North America

### Caller ID

Twilio's **Acceptable Use Policy** (effective 12 May 2025) prohibits
*"Falsification of Identity or Origin"* — creating a false identity or
attempting to mislead as to the origin of communications — and prohibits
violating *"laws, regulations, governmental orders, industry standards, or
telecommunications providers' requirements"* in any applicable jurisdiction.
([Twilio AUP](https://www.twilio.com/en-us/legal/acceptable-use-policy))

Mechanically, Twilio enforces this: the `From` on an outbound call must be
either **a Twilio number in your account** or **a Verified Caller ID** whose
ownership you proved. Anything else fails with [error
21210](https://www.twilio.com/docs/api/errors/21210). ([How to add and remove a
verified caller
ID](https://support.twilio.com/hc/en-us/articles/223180048-How-to-Add-and-Remove-a-Verified-Phone-Number-or-Caller-ID-with-Twilio))

**So area-code-matched local presence is permitted, on one condition: buy the
numbers.** A real number, provisioned to FieldQuo, that a prospect can call
back and reach a human. That earns full ("A") STIR/SHAKEN attestation. A rented
or shared pool number, or a number FieldQuo does not own, is spoofing and is
prohibited both by Twilio and by the Truth in Caller ID Act.

Practical consequence: a genuine local-presence footprint across Canadian and
US markets means **dozens of purchased numbers, each of which must ring
somewhere sensible** — plus per-number monthly cost, plus the callback path.
This is a real line item, not a config flag.

### Buying local numbers, and being registered in both countries

Twilio gates number purchase behind an address, and for many number types a
**Regulatory Bundle**. For Canadian numbers Twilio requires the authorised
user's name, the business name, and a **true physical service address** — PO
boxes are rejected. Businesses registered outside the US must supply their
official business registration number, the country of registration, and the
issuing authority (e.g. Corporations Canada). Bundle review runs up to two
business days. ([Phone number regulatory
FAQ](https://www.twilio.com/docs/phone-numbers/regulatory/faq), [How to submit
a regulatory
bundle](https://support.twilio.com/hc/en-us/articles/8338625205147-How-to-Submit-a-Regulatory-Bundle-for-Phone-Number-Regulatory-Compliance),
[Regulated number bundle provisioning
requirement](https://www.twilio.com/en-us/changelog/regulated-number-bundle-provisioning-requirement))

**FieldQuo being registered in both Canada and the US should satisfy this**, and
it is a meaningful advantage: entity documents and a real address in each
country are exactly what the bundle asks for. Expect to supply, per country:
legal entity name, business registration number and issuing authority, a
physical address that is not a PO box, and a named authorised representative.
Twilio publishes per-country requirements at
[twilio.com/en-us/guidelines/regulatory](https://www.twilio.com/en-us/guidelines/regulatory)
— check Canada and the US there before ordering, because the requirement list
changes.

One implementation note from this repo: FieldQuo does not dial Twilio directly
for voice today. `lib/voice/numberSearch.js` searches Twilio's inventory, and
Retell buys and places the call (`number_provider` defaults to twilio). For a
sales dialler that FieldQuo owns end to end, going straight to Twilio Voice is
the simpler posture — the numbers are FieldQuo's own, not a tenant's, and the
attestation chain is shorter.

### Does the rep sitting in Ukraine change the legal position?

**Your framing is right, and the sources support it.** The destination
country's rules govern the call:

- The TCPA and the TSR are aimed at protecting people receiving calls in the
  US; there is no origin-based exemption, and the FTC/FCC have pursued
  offshore-originated campaigns. The practical difference is enforcement
  reach — and **FieldQuo does not get that difference, because it is a
  registered Canadian and US entity.** A regulator does not need to reach
  Ukraine; it reaches the company.
- Same in Canada: the CRTC's difficulty with foreign telemarketers is
  *enforcement*, which is why it convenes an International Do Not Call Network.
  A Canadian-registered caller is not in that category.

So: **not a legal exemption, and not even a practical shield.** It is a carrier
policy, quality and disclosure question. Three live considerations:

1. **The FCC's offshore call-centre proposal, NPRM FCC-26-16A1, released 27
   March 2026** would require disclosing at the start of a call that a
   representative outside the US is handling it, name the country, offer
   transfer to a US-based rep, cap offshore handling, and **prohibit call
   centres in named "foreign adversary nations" (China, Russia, Iran, North
   Korea, Cuba, Venezuela)**. Ukraine is not on that list. The proposal is
   currently aimed at telecom/VoIP/cable/DBS providers, with comment sought on
   extending it to all TCPA-covered entities. **This is a proposal, not a
   rule.** ([Cooley
   analysis](https://www.cooley.com/news/insight/2026/2026-04-08-fcc-proposes-sweeping-rules-on-foreign-call-centers-onshoring-mandates-consumer-protections-and-robocall-deterrence),
   [Davis Wright Tremaine
   analysis](https://www.dwt.com/blogs/broadband-advisor/2026/04/fcc-proposes-limits-on-offshore-call-centers))
   Worth watching, and worth designing the script so an agent-location
   disclosure could be added without re-architecting.
2. **Personal data crosses a border.** A Ukraine-based employee reading a
   Canadian contractor's name, phone and call transcript is a cross-border
   handling of personal information. Under PIPEDA this is permitted with
   comparable protection and transparency; Quebec's Law 25 expects a privacy
   impact assessment before communicating personal information outside Quebec.
   FieldQuo's privacy policy currently makes **no data-residency claim at all**
   (`lib/legal/processors.js` header, and the policy's own residency paragraph)
   — which is honest, and also means adding "our staff outside Canada access
   this data" is a policy edit the check script will not catch for you.
3. **Ukraine under martial law** (extended again from 2 August 2026) is a
   business-continuity fact, not a compliance one — but a calling operation
   with no failover is a calling operation with an outage risk.

### One adjacent flag — not our problem to solve

Employing staff in Ukraine through a Canadian or US entity raises
**employer-of-record and permanent-establishment** questions: whether the
foreign entity is deemed to have a taxable presence in Ukraine, and who is the
lawful employer for payroll and social contributions (employer contributions
run around 22% on top of salary). An EOR is the usual structure and does not by
itself remove PE risk — how the work is actually directed matters more than
titles. **This is a question for the owner's accountant, not for this build.**
One line, as asked; I did not research it further.

## 10. Crawling contractors' websites

At ~1,000 sites, this is the most defensible data source in the whole plan —
if done with restraint.

### Legal

- **CFAA (US).** After *Van Buren* (Supreme Court, 2021) and *hiQ v. LinkedIn*
  (9th Cir., 2022), accessing data that is publicly available without any
  authentication is generally not "unauthorized access" under the CFAA. ([Jenner
  & Block
  analysis](https://www.jenner.com/en/news-insights/publications/client-alert-data-scraping-in-hiq-v-linkedin-the-ninth-circuit-reaffirms-narrow-interpretation-of-cfaa))
- **But hiQ lost anyway.** In November 2022 the court found hiQ had breached
  LinkedIn's user agreement — accepted by creating accounts — and the case ended
  in a consent judgment. **The CFAA question and the contract question are
  different questions.** Do not create accounts. Do not click through terms. Do
  not log in to anything.
- **Canada** has no direct CFAA analogue for public data; Criminal Code s.342.1
  (unauthorized use of a computer) targets circumvention, not reading a public
  page. Copyright in the page content, breach of contract on posted terms, and
  PIPEDA on any personal information collected are the live theories. I am not
  aware of Canadian case law settling public-web scraping and did not find any;
  treat this as unsettled.
- **Personal information.** A small contractor's site often publishes an
  owner's name and mobile. In Canada that is business contact information used
  to contact them about their business — inside the PIPEDA exemption, with the
  "solely" caveat from §4 above. Under CASL it is also the strongest basis for
  s.10(9)(b) implied consent: conspicuously published by the recipient, not
  accompanied by a "no CEMs" statement, and a message about running a
  contracting business is relevant to their role. ([CRTC guidance on implied
  consent](https://crtc.gc.ca/eng/com500/guide.htm)) **Capture the evidence at
  crawl time** — the URL and the date the address was found published — because
  under CASL the sender bears the burden of proving consent, and "we found it
  somewhere" is what cost CompuFinder a penalty.

### Defensible

- Obey `robots.txt`. It is not a statute, but ignoring it is the fact a
  plaintiff's lawyer reads aloud.
- Identify the crawler honestly in the User-Agent, with a URL explaining it and
  a contact address.
- One request at a time per host, a real delay between them, and a hard cap.
  1,000 sites at one page every few seconds is nothing; 1,000 sites crawled in
  parallel at full depth is an incident.
- Fetch only what is needed — home, about, services, contact — not a full
  site mirror.
- Cache what was fetched, store the fetch date, and never re-crawl a site more
  often than the data actually changes.
- Honour a takedown request immediately and permanently, which requires the
  suppression list from §5 to exist first.

### Not defensible

- Ignoring `robots.txt` while spoofing a browser User-Agent. The combination
  is what turns a civil argument into a bad one.
- Creating accounts, logging in, accepting terms, or solving anti-bot
  challenges to reach content. (Concretely: `crtc.gc.ca` blocked this session's
  automated access, and the correct response was to stop, not to work around
  it. That is the standard.)
- Aggressive concurrency, or re-crawling on a tight loop.
- Crawling directories and aggregators rather than the contractor's own site —
  those have enforceable terms of service and an active interest in enforcing
  them, and that is precisely the Google problem again in a different costume.

---

# What must be true before a single outbound call is made

Marked **[OWNER]** where it needs the owner personally — a signature, a
payment, a company record, or a decision only he can make. Everything else is
engineering.

### Registrations and legal standing

1. **[OWNER] Register with Canada's National DNCL** at
   [lnnte-dncl.gc.ca](https://lnnte-dncl.gc.ca/). **Free, and mandatory even
   though our calls are exempt.** This is the cheapest item on the list and the
   one whose absence is easiest for a regulator to prove.
2. **[OWNER] Confirm, with counsel, that the B2B position holds for our
   actual pitch** — that FieldQuo's calls are Part-II-exempt in Canada and
   §310.6(b)(7)-exempt in the US, given what reps will actually say. If that
   confirmation does not come back clean, budget $62,166/yr (Canada,
   all area codes) and $23,425/yr (US, all area codes) and re-plan.
3. ~~**[OWNER] Get a state-law read for the US states actually targeted.**
   Bounded and cheap once the target list exists; unbounded if skipped.~~
   **DONE 2026-09-03** for 49 states plus DC — encoded as data in
   `lib/sales/callingRules.js`, every row carrying the statute, the operative
   scope words and the URL it was read at. Iowa and Vermont are deliberately
   still `unknown`; see their rows for why. What the read changed about the
   picture, and what is now on the owner rather than on the build:

   - **This is not a calling-hours problem, it is a REGISTRATION problem.**
     Fourteen jurisdictions require FieldQuo to register — several with a bond
     — *before the first call*, and their business-to-business exemptions do
     not reach it. Texas is the trap: §302.056 is titled "Certain Commercial
     Sales" and reads like a B2B exemption, but it covers only a purchaser who
     resells the item or uses it in manufacturing. A contractor buying software
     to run his own business is neither. Sharpest first: **Vermont** (criminal,
     up to 18 months and $10,000 *per call*), **DC** ($50,000 bond, 60 business
     days' lead time), **Mississippi** ($75,000 bond), **Ohio** ($50,000 bond,
     fifth-degree felony), **Rhode Island** ($30,000), **Utah** ($25–50,000 plus
     fingerprints), **Texas** ($10,000 security).
   - **Arizona cannot be called at all on this data.** A.R.S. §44-1278(B)(3)
     bans an unsolicited sales call to any mobile number outright and
     §44-1273(A) preserves that against every exemption in the article. Nothing
     in the prospect record says whether a number is mobile, so Arizona
     refuses. ~18,000 businesses.
   - **The script is now a legal input, not just a sales one.** Arkansas
     §4-99-103(9), California §17511.1(a)(3)–(4) and Alabama §8-19A-3(3) each
     key a registration-and-bond regime to representations that a price is
     *below the regular price* or that a price rise is imminent. A "20% off,
     ends Friday" cold-call script pulls FieldQuo into regimes it currently
     sits outside.
   - **§8's B2B reasoning below is still right about the TSR and still the
     wrong question for the states.** Several states' windows do not use the
     federal residence limit at all: New York's turns on *natural person*, New
     Jersey's on *individual resident*, South Carolina's and Virginia's on the
     *area code of the number dialled*. A sole proprietor is inside all four.
4. **[OWNER] Decide the recording posture** and have counsel confirm it: my
   recommendation is *announce on every call, everywhere, with no jurisdiction
   branching* — it satisfies the all-party consent states and the OPC guidance
   at once, and it is what `lib/voice/prompt.js:93` already does for the
   inbound agent. Cheaper than a jurisdiction map, and it cannot be wrong.
5. **[OWNER] Confirm the Ukraine employment structure with an accountant** —
   employer of record and permanent establishment. Out of scope for the build;
   in scope for the company.

### Data sourcing — before any prospect row is written

6. **Stop planning on Google Places as the prospect store.** Choose a licensed
   source: Overture Places (CDLA-Permissive v2.0) is the recommended default.
   If Places stays in the design at all, it stays as a live verification call
   whose only persisted output is `place_id`.
7. **[OWNER] Optional, worth one call:** ask a Google Maps Platform sales rep
   whether any agreement permits storing Places business data for outbound
   sales. Expect "no". Cheap to ask; expensive to assume.
8. **Add the new data source to `lib/legal/processors.js`** with a `verify`
   pattern, and update `app/(marketing)/privacy/page.js` — including a new
   section covering FieldQuo-as-controller of prospect data — and bump
   `PRIVACY_POLICY_EFFECTIVE_DATE`. `scripts/check-legal-pages.mjs` will force
   the first half; only a human will notice the second.
9. **Write the crawler to the §10 rules**: robots.txt honoured, honest
   User-Agent with a contact URL, serial per host, capped depth, fetch date
   and source URL recorded per field. The recorded source URL is the CASL
   consent evidence; without it the crawl is worth less than it cost.

### Machinery that must exist before the first dial

10. **Build a platform-level suppression list.** Not tenant-scoped. Keyed on
    normalised phone **and** email **and** domain. Every channel writes to it,
    every channel reads it, an entry is never deleted, and every send/dial path
    re-checks it in the same request as the send — the pattern
    `lib/voice/outbound.js:158` and `docs/SALES-OUTREACH.md` §6 already
    establish. This satisfies Canada's internal-DNC-list obligation (three
    years and fourteen days minimum; keeping it forever is simpler and
    strictly safer).
11. **Fix the existing sales opt-out to write to it.** `leadOptedOut()`
    (`lib/sales/outreach.js:481`) is per-lead today; an opt-out binds FieldQuo,
    not one rep's copy of a prospect.
12. **Build a dialler gate of its own — do not widen `lib/voice/outbound.js`.**
    It must refuse on: suppression hit; outside **9:00–21:30 weekday /
    10:00–18:00 weekend in the prospect's own time zone** (not the repo's
    existing 9:00–20:00, which is a homeowner window and is wrong at weekends);
    unknown time zone (refuse, per the existing precedent).
13. **Record the consent basis per prospect.** The column
    `docs/SALES-OUTREACH.md` §4 named and could not add: which basis, and the
    evidence URL and date. Under CASL the sender carries the burden of proof.
14. **Write a call-opening script that identifies FieldQuo, the caller, and the
    purpose in the first breath, gives a callback number, and discloses
    recording** — and make it structurally impossible to place a call outside
    it. The layered-prompt pattern in `lib/platform/salesPrompt.js` is the
    model: absolute rules first, facts second, tone last and explicitly unable
    to override.
15. **Log per call**: who called, from which number, to which number, at what
    local time, whether the recording disclosure was given, and the outcome.
    None of this exists for outbound today, and "we always do it" is not
    evidence.
16. **Decide the retention period for prospect recordings and transcripts, and
    implement the sweep.** The privacy policy currently admits FieldQuo deletes
    nothing on a schedule. Adding recordings of people who never asked to be
    called, to a store with no expiry, is the version of this that ages worst.

### Telephony

17. **[OWNER] Complete Twilio regulatory bundles for Canada and the US** using
    the registered entities: legal name, business registration number and
    issuing authority, a physical (non-PO-box) service address, named
    authorised user. Allow ~2 business days per bundle.
18. **Buy the local numbers FieldQuo will actually display.** Real, owned,
    callback-answering, A-attested. No shared pools, no unowned caller ID.
19. **Give every displayed number a live callback path** — a human, or an
    identified FieldQuo line, not a dead number. This is both the Truth in
    Caller ID line and the Canadian identification requirement.
20. **A human dials, one call at a time.** No autodialler, no predictive
    dialler, no prerecorded or AI voice placing calls, until counsel has looked
    at the TCPA question specifically. This one constraint is what keeps the
    US analysis simple.

### Watch list

21. **CRTC 2026-132** — the open UTR review. Could move the B2B exemption.
22. **FCC NPRM FCC-26-16A1** — offshore call centres. Currently aimed at
    telecom providers; comment sought on extending to all TCPA-covered
    entities. Design the script so an agent-location disclosure can be added
    without rework.

---

## Where I am unsure, and said so rather than guessing

- **Whether profiling and AI-scoring prospects falls outside PIPEDA's business
  contact information exemption.** The statutory word is "solely", and I read
  that as a genuine risk, not a settled answer. Counsel, with the field list.
- **US state telemarketing law.** Not audited. Several states do not mirror the
  federal B2B exemption. Needs the target-state list first.
- **Canadian case law on scraping public websites.** I found none that settles
  it and am not going to invent a position.
- **CRTC figures and exact rule wording.** `crtc.gc.ca` blocked every automated
  fetch; the calling hours, the internal-list retention period and the
  subscription prices came via search extraction from CRTC pages rather than
  from the pages themselves. Directionally I am confident; before anyone pays
  or ships a calling window, a human should open
  [crtc.gc.ca/eng/phone/telemarketing/tobligations/rules-regles.htm](https://crtc.gc.ca/eng/phone/telemarketing/tobligations/rules-regles.htm)
  and read it.
- **Whether any negotiated Google agreement lifts §3.2.3.** I found none. The
  published terms are unambiguous, so this is a question for a Google sales
  rep, not for more searching.
