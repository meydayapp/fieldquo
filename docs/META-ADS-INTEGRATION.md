# Should FieldQuo import Facebook/Meta ad spend? — research and design

Written 31 August 2026, in answer to: "is there a cost to this or is it free?"
plus the broader question of whether to build it.

**Read this first if you only read one section: Part 0.**

---

## Part 0 — The cost answer

**The API calls themselves are free.** There is no per-request fee and no
Meta subscription to read ad-account spend. That is the whole truth of "is it
free," and it is also the least important part of the real cost.

What it actually costs, in order of how much it will hurt:

| Cost | What it is | Size |
|---|---|---|
| **App Review** | Meta's process for approving `ads_read`/`ads_management` for a third-party app | No fee, but real *time*: an app-role video walkthrough, a written use-case, and a live test of the flow by a Meta reviewer. Community reporting from 2025–2026 describes this specific permission cluster as a two-gate approval that "has blocked more SaaS launches than almost any other Meta permission cluster," with a rebuilt appeal flow as of late 2025 that gives one appeal per rejection. Budget **weeks**, not days, and expect at least one round-trip of rejection-and-resubmission — this is not a form you fill in once. |
| **Business Verification** | Meta confirming FieldQuo is a real business entity, mandatory once an app requests Advanced Access to permissions that read *other* businesses' data (which this is, by definition — a contractor's ad account, not FieldQuo's own) | No fee. Requires legal business documents through Meta Business Manager. Un-timed in Meta's own docs; commonly reported as taking from a few days to several weeks, and can stall if the submitted documents don't exactly match the business name registered elsewhere in Meta's systems. |
| **Rate limits** | Real, and per-ad-account | Two tiers: **Limited/Development** access starts every new app at a 60-point budget per ad account and blocks for 300 seconds once exhausted (1 point per read call, 3 per write) — explicitly documented by Meta as "for development, not for production apps used by real advertisers." **Full/Standard** access raises that to 9,000 points with a 60-second block, but only after the app logs 500+ successful Marketing API calls in the trailing 15 days at under 15% errors. A brand-new FieldQuo integration starts throttled and has to *earn* production-grade limits by using the API in production first — a chicken-and-egg period where early tenants get worse behaviour than later ones. |
| **Build** | Multi-tenant OAuth, token storage/refresh, a sync job, a settings screen, error/reconnect UX | Realistically 3–5 weeks for a correct first version (see Part 4) — not a weekend integration, mostly because of the multi-tenant OAuth lifecycle in Part 3, not the API surface itself. |
| **Maintain** | An API that changes on Meta's schedule, not FieldQuo's | Ongoing, not one-time. See below — this is the cost most integrations underquote. |

**On maintenance, specifically, because it's the one the owner should weigh
most heavily:**

Meta's own versioning policy (`developers.facebook.com/docs/graph-api/guides/versioning`,
fetched 31 Aug 2026): *"A version will no longer be usable two years after the
date that the subsequent version is released."* That sounds generous until you
look at the actual release cadence, pulled from Meta's own changelog on the
same date:

| Version | Release date |
|---|---|
| v26.0 | 29 Jul 2026 (current) |
| v25.0 | 18 Feb 2026 |
| v24.0 | 8 Oct 2025 |
| v23.0 | 29 May 2025 |
| v22.0 | 21 Jan 2025 |
| v21.0 | 2 Oct 2024 |

That's a new major version roughly every 4–5 months — 3–4 per year. Every one
of those is a point where Meta can (and, per its own recent history, does)
retire fields, rename response shapes, or block whole endpoint families ahead
of the two-year clock: Marketing API v26.0 blocked 47 commerce endpoints on
release day, and Meta separately deprecated legacy campaign-creation calls in
favour of the Advantage+ structure across *all* API versions, unversioned
calls included, effective 27 Oct 2026. The two-year "safe" window is a floor,
not a promise that nothing breaks sooner — production integrations get
surprised by version-specific field removals inside that window regularly.

**Concretely, for a small team:** this is not a build-once feature. It is a
standing obligation to read Meta's developer changelog several times a year,
re-test the insights sync against whatever changed, and re-run App Review if
the requested permission scope ever needs to grow. A team of FieldQuo's size
(this is a young product, still hardening its core pipeline per
`docs/ROADMAP.md`) taking on a second vendor with this deprecation cadence —
on top of OpenAI, Stripe, Twilio, Resend, Cloudinary, Google Maps/Solar, and
Retell, all already load-bearing — is a real ongoing tax, not a line item that
disappears after ship.

**Sources** (all fetched or searched 31 Aug 2026):
- Graph API versioning policy — https://developers.facebook.com/docs/graph-api/guides/versioning
- Graph API changelog (version release dates) — https://developers.facebook.com/docs/graph-api/changelog
- Marketing API rate limiting — https://developers.facebook.com/docs/marketing-api/overview/rate-limiting
- `ads_read` permission reference — https://developers.facebook.com/docs/permissions/reference/ads_read
- Marketing API authorization / advanced access — https://developers.facebook.com/docs/marketing-api/overview/authorization
- Business Verification — https://developers.facebook.com/docs/development/release/business-verification
- App Review overview — https://developers.facebook.com/docs/app-review
- Third-party commentary on 2026 App Review friction for ads permissions and the commerce-endpoint/legacy-campaign deprecations (community sources, not Meta-authored; corroborate rather than replace the primary docs above): singhamandeep.com/meta-graph-api-version-deprecation, ppc.land coverage of v26.0 and Advantage+ deprecation, get-ryze.ai on the 2026 appeal-flow rebuild.

**Two products the owner may be conflating — this document is about the first
one only:**

1. **Marketing API / Insights** (what "import ad spend" means) — reading
   spend, impressions, clicks *into* FieldQuo. Everything above is about this.
2. **Conversions API** — a completely different product that sends
   FieldQuo's own conversion events (a quote sent, a job booked, an invoice
   paid) *out* to Meta, as hashed customer PII, so Meta's ad targeting can
   improve. Meta's Customer Information Parameters spec hashes email (`em`)
   and phone (`ph`) with SHA-256 before transmission — the values are hashed,
   not encrypted, and Meta's own matching guidance says confidence rises when
   email, phone, and browser identifiers are sent *together*, i.e. the
   product is designed to want more identifying data, not less. This is not
   what was asked for, and it is a materially different privacy decision: it
   means a homeowner's contact information leaves FieldQuo for Meta's ad
   systems, and homeowners never agreed to that — they agreed to hire a
   contractor, not to be advertised to on the contractor's behalf. Given
   non-negotiable #1 in `AGENTS.md` ("every document the homeowner sees looks
   like it came from the contractor, not from us") and the privacy page's own
   framing of FieldQuo as a processor acting narrowly on a company's
   instructions, sending homeowner PII to a fourth party for ad optimisation
   is a product and legal decision on its own, not a feature. **This document
   does not recommend building it, and it should not be bundled into "import
   ad spend" scope without a separate, explicit conversation.**

---

## Part 1 — What FieldQuo already has that this would plug into

The hole is real and already documented, independent of this research:

- **`prisma/schema.prisma:4065-4079`** — `MarketingSpend` model: platform,
  campaign name, amount, impressions, clicks, leads, conversions, date. The
  `platform` field is a `MarketingPlatform` enum
  (`prisma/schema.prisma:4847-4854`) that **already includes `facebook`** —
  someone anticipated exactly this channel and never finished the loop.
- **`lib/analytics/marketingRollup.js:1-58`** — `getMarketingRollup()` reads
  `MarketingSpend`, rolls it up by channel, and computes `costPerLead` and
  `costPerConversion` per channel today, purely from whatever numbers are in
  the table.
- **`lib/ai/monthlyDigest.js:6,22-24`** — the only caller of
  `getMarketingRollup()`. The monthly AI digest email includes this rollup,
  which means it has been reporting **$0 spend across every channel, every
  month**, since the digest shipped.
- **`app/api/marketing-spend/route.js`** and
  **`app/api/marketing-spend/[id]/route.js`** — full CRUD (GET/POST/PATCH/DELETE),
  scoped to `member.companyId`, already permission-checked. No screen calls
  any of it.
- **`scripts/check-route-callers.mjs:144-147`** and **`docs/TODO.md:223,267-270`**
  both already name this exact gap: "MarketingSpend is READ ... and no screen
  writes it, so the digest reports zero spend forever ... Small build: date,
  platform, amount." That's the manual-entry screen referenced in Part 6's
  recommendation — it was already scoped by a previous pass over this
  codebase, before this research started.
- **A related, separate feature: `MarketingCampaign`**
  (`prisma/schema.prisma:3087-3118`, `app/app/marketing/page.js`,
  `app/api/marketing/campaigns/route.js`). This is a *different* model — a
  campaign has `type` (`meta_ads` is one of the enum values,
  `TYPE_LABELS.meta_ads` in `app/app/marketing/page.js:23`), a manually
  entered `budget`, and an `externalUrl`. It tracks that a Meta campaign
  *exists*, with a budget someone typed in, but it has **no relation to
  `MarketingSpend`** (no shared foreign key — they are two unconnected
  tables that happen to both know the word "facebook") and **no relation to
  `LeadRequest`**. A contractor could theoretically log a Meta campaign here
  and log spend in the other table and get two disconnected numbers that
  never reconcile. This is not something to fix as part of an import — it's
  flagged here so it isn't rediscovered as a surprise mid-build.
- **A live, already-shipped claim worth flagging on its own:**
  `lib/marketing/featureMatrix.js:1166-1182` lists a public feature —
  `marketing_spend`, `readiness: "shipped"` — with the summary *"Spend by
  channel against the jobs it actually brought in, so you can stop paying for
  the ones that don't."* This feeds FieldQuo's own public marketing pages
  (`app/(marketing)/features/FeaturesIndexContent.js`,
  `app/(marketing)/compare/*`) via `scripts/check-feature-pages.mjs`, which
  verifies the `proof` file exists and contains the named string, not that
  the feature functions. "Against the jobs it actually brought in" is a
  factual claim about attribution that is untrue today — `MarketingSpend` has
  no data in it at all (nothing writes it) and even if it did, nothing links
  a job to a channel. **This is a false claim on FieldQuo's live marketing
  site right now, independent of any Meta decision**, and should be corrected
  regardless of what happens with this document's recommendation — either by
  building the manual-entry screen (Part 6) so the "spend by channel" half
  becomes true, or by softening the copy so it stops promising attribution
  the product doesn't have.

- **`lib/analytics/kpis.js:636-643`** — the constraint that frames everything
  below. `costPerLead` is deliberately in `NOT_TRACKED`, with the reason
  quoted verbatim in the assignment brief for this document: *"MarketingSpend.leads
  is typed in by hand, and no lead — LeadRequest — carries a campaignId or a
  UTM value. A cost-per-lead figure built on a hand-typed denominator and no
  source attribution would look precise and mean nothing."*
- **`prisma/schema.prisma:3330-3342`** — `LeadRequest` has `source: String?`
  (free text, e.g. what a call-recovery flow or a form submission happens to
  write) and nothing else that could carry a campaign identity. There is
  **no UTM capture anywhere in the codebase** — confirmed by grep across
  `app/` and `lib/`; the only hits for "utm" in the whole tree are unrelated
  matches on the substring inside `inputMode` attributes. No self-quote form,
  booking link, or public quote page reads or stores `utm_source`,
  `utm_campaign`, `fbclid`, or any other tracking parameter today.

**The picture, in one sentence:** FieldQuo has a spend table nobody writes to,
a campaign table that doesn't talk to the spend table, a lead table with no
way to name what brought the lead in, and a live marketing claim promising
attribution across all three that doesn't exist. Importing Meta's numbers
automatically would fix exactly one of those four problems.

---

## Part 2 — The attribution problem, and an honest proposal

**The owner's actual ask is broader than "import Meta spend": a complete
cost-per-lead picture, Meta alongside every other way a lead reaches
FieldQuo** — self-quote form, booking page, instant quote, the AI phone
receptionist, referrals — not the Facebook slice reported in isolation. That
reframes the design question, and it also means the attribution gap isn't a
Meta-specific problem to solve once and reuse; it's the central problem, and
it needs answering for the whole funnel, not just the paid-ads corner of it.

**Importing spend automatically does not fix the denominator.** The quoted
comment in `lib/analytics/kpis.js` is right, and importing spend from Meta's
API instead of a human typing it in changes *only* where the numerator comes
from. `MarketingSpend.leads` would still be a number someone has to
separately, manually decide and type — Meta's API knows what it spent and
what it got in clicks/impressions/conversions *on Meta's own definition of a
conversion* (a pixel fire, a lead form submit inside Facebook), but it has no
idea which row in FieldQuo's `LeadRequest` table, if any, resulted. Meta
cannot tell FieldQuo "this $340 produced 3 real leads in your CRM" because
Meta has never seen FieldQuo's CRM. That link can only be built on FieldQuo's
side, and nothing on FieldQuo's side builds it today.

### What "every funnel" actually looks like today

`lib/leads/createLead.js` is the single writer of every `LeadRequest`
(deliberately — see its header, the same "one path so the copy can't rot"
discipline as elsewhere in this codebase), and every caller stamps a real
`source` value on the way in:

| `source` value | Where it's set | What it is |
|---|---|---|
| `self_quote` | `app/api/self-quote/route.js:144` | Public self-quote form |
| `self_quote_kitchen` | `app/api/self-quote/kitchen/route.js:170` | Kitchen designer self-quote |
| `instant_quote` | `app/api/instant-quote/[companySlug]/request/route.js:210` | Instant-quote flow |
| `phone_agent` | `app/api/voice/tools/[tool]/route.js:257` | AI phone receptionist (Retell) |
| `client_portal` | `app/api/portal/[token]/request/route.js:34` | Existing client requesting new work |
| `embed_form` | `app/api/leads/public/route.js:49` | Embedded lead-capture widget |
| `manual` | staff-typed, e.g. `app/api/voice/tools/[tool]/route.js:310` | Staff logging a lead by hand |
| `imported` | `app/api/leads/import/route.js:63` | Bulk CSV import |

That's real, already-structured funnel data — every one of those channels is
independently countable today by a plain `groupBy` on `LeadRequest.source`
over a date range. Two gaps sit outside that table entirely, and both matter
to "every funnel":

- **The booking page produces no `LeadRequest` at all.** Grepped
  `app/api/booking/[companySlug]/route.js` and
  `app/api/booking/[companySlug]/confirm/route.js` for `leadRequest` —
  no match. A homeowner who books a paid visit slot directly goes straight to
  a `Booking`/`Job`, never through the lead pipeline. That funnel is
  currently invisible to any lead-count-based metric; a complete picture
  needs its own count (bookings created in the period, by source) alongside
  the lead counts, not folded into them.
- **"Referrals" isn't a `LeadRequest.source` value anywhere in the
  codebase.** `MarketingPlatform.referral` (`prisma/schema.prisma:4852`)
  exists as a *spend-entry* category — a contractor could log "$50 gift card
  for a referral" as spend — but nothing stamps `source: "referral"` on the
  resulting lead; it would show up as `manual` at best, indistinguishable
  from any other staff-typed entry, unless a contractor is disciplined about
  writing it in the message field. (Also worth flagging so it isn't confused
  mid-build: `app/refer/[code]/page.js` and `lib/referrals` are FieldQuo's
  *own* company-to-company signup referral program — a different "referral"
  than a homeowner referring their neighbour to a contractor. The naming
  collision is real; the two systems are unrelated.)

So the real design question is not "how do we import Meta's numbers" — that
part is a straightforward Insights API call. It's **"what would it take to
show a true cost-per-lead across every channel, and how much of that is
buildable before taking on Meta's App Review clock at all?"** Three honest
levels, from cheapest to most complete:

### Level 1 — Blended cost-per-lead, buildable now, no attribution needed

This is the one genuinely new idea this reframing surfaces, and it directly
answers what the owner asked for without waiting on Option 3 below. It does
**not** require knowing which channel produced which lead — only two totals
for the same period:

- **Numerator:** total marketing spend across every channel —
  `sum(MarketingSpend.amount)`, whatever mix of manually-entered (pamphlets,
  referral incentives) and, if built, Meta-imported rows exists for that
  period.
- **Denominator:** total real leads across every *live* intake channel —
  `count(LeadRequest)` grouped by the table above, for the same period. Not
  `MarketingSpend.leads` (the hand-typed per-channel figure
  `lib/analytics/kpis.js` already distrusts) — the actual row count from the
  table that every real lead already lands in.

`blendedSpend / blendedLeadCount` is an honest number: "across everything
you're doing to generate leads, you're paying about $X per lead this month."
It cannot say *which* channel is efficient — that's Level 3 — but it is not
fabricated, because it never claims a link between a specific dollar and a
specific lead, only a real total over a real total. This is meaningfully
different from the `costPerLead` KPI `lib/analytics/kpis.js` refuses per
channel, and doesn't reopen that refusal — it's a company-wide efficiency
figure, the same kind of claim `buildRevenuePerEmployee` already makes safely
(`lib/analytics/kpis.js:518-527`: a snapshot ratio, stated as one sentence
about the whole company, not decomposed into a claim the data can't support).

Two judgement calls worth deciding explicitly, not silently:
- **Whether `manual` and `imported` leads belong in the denominator.** They
  probably shouldn't count toward "what my marketing spend produced" — a
  bulk CSV import of old leads or a staff member typing in a walk-in customer
  isn't something this month's ad spend caused, and including them would
  quietly deflate the blended figure. Recommend excluding both by default,
  shown as an explicit exclusion count ("+ 4 leads entered manually, not
  counted") rather than silently dropped, matching the `incomplete`/`reason`
  discipline `lib/analytics/kpis.js` uses everywhere else.
- **Whether the booking-page funnel belongs in the same denominator.** It
  isn't a `LeadRequest` today (see above), so including it means adding a
  second count alongside the lead count, not merging the two into one number
  that would misrepresent what a "lead" is.

### Level 2 — Spend by channel, next to lead counts by intake mechanism — shown side by side, never divided

The next honest step up, still without inventing a link: show
`getMarketingRollup()`'s per-channel spend table next to a per-`source` lead
count table, on the same screen, over the same period — but never compute one
against the other. A Facebook ad can land a click on the self-quote form
*or* ring the phone agent *or* submit through an embedded form; "channel"
(where the money went) and "intake mechanism" (how the lead reached
FieldQuo) are different axes today, and nothing links them. Showing both
without dividing them gives a contractor real visibility ("I spent $800 on
Facebook and got 40 self-quote submissions this month") without asserting
the 40 came from the $800 — because nothing in the system currently knows
that.

### Level 3 — Full attribution (the real fix, and a real project)

1. Add `utm_source`, `utm_medium`, `utm_campaign`, and (for Meta specifically)
   `fbclid` capture to every public entry point that can carry a query
   string: the self-quote form (`app/quote/[companySlug]`), the booking page,
   the instant-quote flow, and the public marketing pages that link out to
   them. Persist whatever arrived on `LeadRequest` at creation time — a small
   schema addition, and the capture itself is cheap (read `searchParams`,
   store it).
2. A contractor has to actually **tag their Meta ad URLs** with UTM
   parameters (or FieldQuo can generate the tagged links for them, per
   campaign, from the settings screen in Part 4 — the safer version, because
   it removes a step a busy one-person shop will otherwise skip). Without
   this step, nothing arrives to capture no matter how good the receiving
   code is.
3. Match `fbclid`/UTM values against the campaign/ad names the Insights API
   returns, to build the `campaignId` link `lib/analytics/kpis.js` says is
   missing. Realistically this needs a `MarketingCampaign.metaCampaignId` (or
   similar) column and a join, not a fuzzy match on names.
4. **The phone-agent channel needs a different mechanism entirely, and it's
   the biggest gap in "every funnel."** A phone call carries no URL and no
   query string — a `fbclid` cannot ride along on a voice call the way it
   rides along on a click. The only way to attribute a `phone_agent` lead to
   a specific campaign is call tracking: a distinct tracking phone number per
   campaign (or at minimum per channel), dynamically inserted into the ad
   creative/landing page, so the number itself is the attribution signal.
   FieldQuo already owns the piece that would make this possible —
   `lib/sms/twilioClient.js` and the Retell voice stack already provision
   and route numbers — but dynamic number insertion per campaign is its own
   scoped project layered on top of the Twilio integration, not something
   the Meta Insights API touches at all. Leaving phone-agent leads
   unattributed (counted in Level 1's blended total, absent from any
   per-channel breakdown) is the honest default until that's built.
5. Only *then* does `costPerLead` on a specific channel become a number
   built on real attribution rather than a hand-typed denominator — and even
   then, it is honest to say it will still undercount: some real leads phone
   in after seeing an ad without ever clicking a tagged link (see 4 above),
   and the KPI layer's own `RATE_FLOOR`/`COUNT_FLOOR` discipline
   (`lib/analytics/kpis.js:77-95`) would still need to suppress a channel's
   cost-per-lead below whatever sample floor makes sense for a rate built on
   this thinner a foundation.

This is a genuinely separate, larger project — new schema, new capture points
on every public form, a UTM-link generator, a call-tracking layer for the
phone channel, and it *requires the contractor to change how they run their
ads* (use FieldQuo's generated links and tracking number) to work at all. It
is not a sub-task of "import spend."

### What ships in the Meta import itself, regardless of level

Whichever level the owner ultimately wants, the Meta-specific half of the
work is the same: import spend, and show only what's true without inventing
a link to FieldQuo's own leads.

Show the numbers Meta's own API can answer honestly, and refuse the ones it
can't, the same way `lib/analytics/kpis.js` already refuses `costPerLead` and
five other metrics rather than fabricate them:

- **Total and per-campaign spend, by day/week/month** — true, useful on its
  own (a contractor can see they spent $1,200 on Meta ads last month, whether
  spend is trending up or down, whether a specific campaign is burning
  budget faster than planned).
- **Meta's own click/impression/CTR figures** — true, and already what Meta
  measures; no FieldQuo attribution needed.
- **Meta's own "leads" or "conversions" count, labelled as Meta's, not
  FieldQuo's** — e.g. "23 lead-form submissions reported by Meta," clearly
  distinct from "23 leads in your FieldQuo pipeline." Do not let these two
  numbers sit next to each other looking like the same kind of fact.
- **Refuse to compute or display cost-per-*FieldQuo*-lead, or any figure that
  divides Meta's spend by FieldQuo's own lead/job/revenue counts**, exactly
  as `NOT_TRACKED` already refuses `costPerLead` today, and for the identical
  reason: no source attribution, so the number would look precise and mean
  nothing. Extend `lib/analytics/kpis.js`'s `NOT_TRACKED` pattern rather than
  inventing a second way to say "we don't have this."

**Recommendation on this question specifically:** build Level 1 (blended
cost-per-lead) now, independent of Meta — it needs no Meta API access at
all, just the manual `MarketingSpend` entry screen from Part 6 plus a
`groupBy` over `LeadRequest`, and it is the most direct answer to "what am I
paying per lead across everything I do." Add Level 2 (side-by-side spend vs.
intake-mechanism counts) once Meta import exists, as pure visibility with no
new claim. Treat Level 3 (full attribution, including phone-call tracking)
as a separately-decided, larger project — it is a bigger commitment
(contractor behaviour change, new capture surfaces, a matching layer, a
call-tracking build) than this document was scoped to design, and it is the
only level that can honestly answer "cost per lead, by channel."

---

## Part 2b — Lead quality: telling a real inquiry from an accidental click

The owner's own framing is the right one to start from: *"sometimes there is
junk created by people accidentally clicking on an ad — not sure if there
would also be a way to clean that so that it is more realistic."* Two
separate questions live inside that: what Meta itself offers, and what
FieldQuo can do with data Meta never sees.

### What Meta offers, and what each option actually costs

- **"Higher Intent" Lead Ads forms, plus SMS/work-email verification** — a
  setting the *contractor* turns on in Meta Ads Manager itself, for free,
  with zero FieldQuo engineering. It adds a review-and-confirm step before a
  Lead Ads (Instant Form) submission, and can require a one-time SMS code
  before the form completes. This only applies to Meta's native Lead Ads
  format specifically — it does nothing for a campaign that sends clicks to
  FieldQuo's own self-quote page, which is the more likely setup here given
  FieldQuo already has a public quote flow to send traffic to. Worth
  surfacing as a one-line tip in the eventual settings screen ("running Lead
  Ads? Turn on Higher Intent in Meta Ads Manager to cut down accidental
  submissions") rather than building anything — it's a Meta-side lever, not
  an integration.
- **"Conversion Leads" optimisation + the Conversions API CRM feedback
  loop** — this is Meta's real quality mechanism, and it is the *same
  Conversions API already flagged as out of scope in Part 0*, not a
  lighter-weight cousin of it. It works by the advertiser sending downstream
  outcome data — which leads turned into real customers — back to Meta via
  CAPI, matched by the Meta Lead ID or by hashed email/phone/click-id, so
  Meta's delivery algorithm learns to show the ad to people who resemble
  past *qualified* leads rather than past raw submissions
  (`developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration`,
  fetched 31 Aug 2026 — requires a Meta Pixel, is documented as "currently
  only compatible with Facebook/Instagram's Lead Ads (Instant Forms)," and
  needs the Meta Lead ID or matching identifiers stored in the CRM). Two
  things worth being direct about: **(1)** this sends homeowner-identifying
  data to Meta — the exact privacy question Part 0 already declined to fold
  into this project — so building it *only* to get a quality signal reopens
  the decision this document is explicitly not recommending. **(2)** it
  optimises *future* ad delivery, not the numbers already sitting in this
  month's report — it cannot retroactively tell FieldQuo which of the leads
  already collected were accidental clicks. It answers "how do I get fewer
  junk leads next month," not "how do I get an honest number for this
  month," which is closer to what was actually asked.

**In short: the meaningful Meta-side lever (Conversion Leads/CAPI) is the
same heavier, PII-sending product already deferred in Part 0, and it doesn't
even solve the stated problem — cleaning up an existing count. The free
lever (Higher Intent forms) is real but narrow, Meta-side, and worth a
mention, not a build.**

### What FieldQuo can do with what it already has

This is the stronger half of the answer, and it doesn't touch Meta at all.
Every lead, from every channel, already carries real downstream signal
FieldQuo has and Meta never will:

- **`lib/leads/score.js`** (`scoreLead()`) already computes a 0–100 score and
  a hot/warm/cold `temperature` at creation, from real signals — timeline,
  stated budget, contactability (phone/email present), engagement (photos, a
  drawn kitchen plan, message length) — with a human-readable reason for
  every point (`scoreReasons`), explicitly built as "a transparent,
  explainable heuristic — NOT a model" so a rep can see why and overrule it
  (the file's own header). It already channel-adjusts: `phone_agent` leads
  aren't docked for a budget question the receptionist is forbidden to ask
  (`UNASKABLE_BY_SOURCE`, `lib/leads/createLead.js:39-44`).
- **`LeadRequest.status`** (`new` → `contacted` → `converted`/`lost`,
  `lib/leads/pipeline.js:44`) and **`quoteId`**
  (`prisma/schema.prisma:3415-3416`) are ground truth about what actually
  happened *after* the lead arrived — did staff ever reach out, did it
  become a priced quote, did the client say yes. Meta has no visibility into
  any of this; it is exactly the kind of downstream signal the owner's
  message correctly identifies as FieldQuo's advantage.

**What's missing, stated plainly, is a *reason* on the dead end.** `lost` is
one bucket today — a real lead that shopped around and picked a competitor
and a lead that was a wrong-number butt-dial both land in the same status,
with nothing distinguishing them except whatever a staff member happened to
type into a `LeadNote`. That gap is real and worth naming rather than
papering over with a heuristic guess.

**Two designs, and a recommendation between them:**

1. **Filter at ingestion** — guess which leads are junk when they arrive
   (e.g. suppress anything scoring near zero) and exclude them from counts
   automatically. **Reject this.** It is exactly the shape of heuristic the
   owner's own caution — and this codebase's whole discipline — is written
   against: a scoring model tuned for "which lead to call first" is not the
   same claim as "which lead is not real," and a genuinely slow-to-respond
   but real prospect (terse message, no stated budget, still a real job)
   would be silently discarded from every count with no way for the
   contractor to know it happened. A heuristic that quietly drops real leads
   is worse than a count that's a little inflated — the brief for this
   document says so directly, and it's right.
2. **Report against qualified leads, using ground truth, always visible and
   reversible.** Show the raw lead count as the number of record — never
   hidden, never replaced. Alongside it, show a second, clearly-labelled
   figure built from what the contractor's own team actually did with the
   lead: leads that reached `contacted` or beyond (someone reviewed it and
   didn't immediately write it off), and leads that became a quote
   (`quoteId` set). Neither of these requires guessing intent — both are
   things that actually happened. Add a `lostReason` field to `LeadRequest`
   (a small, genuinely useful schema addition on its own, independent of
   Meta) so that when staff move a lead to `lost`, they pick a real reason —
   "went with someone else," "price too high," "never responded / not a
   real inquiry" — the same way `canSetLeadStatus`
   (`lib/leads/pipeline.js:44`) already refuses to let "converted" be set
   without a quote behind it. Once that exists, "not a real inquiry" becomes
   a number a human explicitly recorded, not a machine's guess — and every
   lead counted that way is one click away from being reopened if the
   contractor disagrees with their own past self.

**Recommendation:** build option 2, and build it as its own small piece of
work independent of the Meta decision — it improves every channel's numbers,
not just Meta's, and it's the same size of effort as the manual
`MarketingSpend` screen already recommended in Part 6. Do not build a
junk-filtering heuristic, and do not make Conversions API's CRM feedback
loop a prerequisite for an honest number — it solves a different problem
(future targeting) at a cost (homeowner PII to Meta) this document already
declined to take on in Part 0.

---

## Part 3 — The multi-tenant problem

This is the part most integrations of this shape get wrong, and FieldQuo's
own architecture makes the constraints sharper than usual.

**Whose app is it?** One FieldQuo-owned Meta app, used by every tenant — the
same shape as Stripe Connect (`lib/stripe/connectAccount.js`,
`app/api/stripe/connect/*`), where one FieldQuo Stripe platform account
mediates each contractor's own connected account. Meta's docs describe
exactly this pattern for third-party apps: request `ads_management`/`ads_read`
advanced access, and each business owner individually authorizes the app
against *their own* ad account via OAuth. Meta additionally documents Business
Manager–based access (a business assigning FieldQuo's app as a Partner, or a
System User token scoped to that business) as the standard path for
production access to someone else's ad account — which means a contractor
who has never set up a Meta Business Manager (common for a one- or two-person
shop running ads from a personal Facebook account) has real setup work to do
*before* FieldQuo's side of the connection even starts. That's a genuine
adoption barrier this document flags rather than resolves: assume the actual
usable audience on day one is contractors who already run ads through a
Business Manager, not every contractor who has ever boosted a post.

**Per-tenant tokens: storage, refresh, and revocation.** FieldQuo already has
two precedents worth following rather than reinventing:

- `Account` (`prisma/schema.prisma:1548-1562`, Better Auth's own table) stores
  `accessToken`/`refreshToken`/`accessTokenExpiresAt`/`refreshTokenExpiresAt`
  per user — the general OAuth-token shape already in the schema.
- `Company.stripeAccountId` (`prisma/schema.prisma:988`) and the wider Connect
  flow show the simpler pattern FieldQuo actually uses for a *company-level*
  third-party account: an id stored directly on `Company`, with status
  re-fetched live from the provider rather than cached, and a dedicated
  settings page (`app/app/settings/payments/page.js`) surfacing what's
  outstanding.

A Meta connection should follow the second pattern: a `Company`-scoped
(or, if a company later has more than one Meta ad account, a small
`MetaAdAccountConnection` model) row holding the long-lived token and the
connected `act_<id>`, with refresh handled the way Meta's OAuth actually
works — long-lived user tokens (~60 days) that need silent refresh before
expiry, not the short-lived-token dance. **What happens when one expires or
is revoked matters more than the happy path**: the brief for this document is
right that a silently-dead integration reporting $0 spend is worse than no
integration — it looks like the exact "control that appears to work and
doesn't" `AGENTS.md` is written to catch, and it is the same failure shape
that made `MarketingSpend` report zero spend forever in the first place, just
with a Meta logo on it instead of an empty form. The sync job must:
1. Detect an auth failure explicitly (Meta returns a distinguishable error
   for an expired/revoked token) rather than silently writing zero rows.
2. Flag the connection as broken on the company's settings screen — not bury
   it in a log only FieldQuo staff can see.
3. Stop the monthly digest from reporting a $0 spend figure for a channel
   whose connection is broken; it should say "not connected" or "connection
   needs reauthorizing," the same `null`-vs-`0` discipline
   `lib/analytics/kpis.js`'s header already argues for everywhere else in
   this codebase (`value` is never 0 standing in for "unknown").

**White-label — non-negotiable #1.** This is the good news in an otherwise
heavy set of constraints: **connecting a Meta ad account is entirely a
`/app` (back-office) action.** The contractor who clicks "Connect Meta Ads"
is the same person who logs into FieldQuo's back office every day and already
sees "FieldQuo" throughout that surface — there is no homeowner anywhere in
this flow. Facebook's Login/OAuth dialog does display the requesting app's
name and icon to the person authorizing it ("FieldQuo wants to access your
ad account"), but the person seeing that screen is the contractor, not their
client, and the contractor already knows they use FieldQuo. This does not
touch client-facing surfaces (`/quote/*`, `/book/*`, `/portal/*`, `/site/*`)
at all, so it does not create the kind of leak `AGENTS.md` is protecting
against. The one thing to actively avoid: don't let a Meta-sourced number
(a campaign name, an ad creative thumbnail) end up rendered anywhere a
homeowner could see it — there's no current plan to do that, but it's worth
stating as a boundary given how easily "show the spend/leads dashboard"
ideas drift toward "show the client their own campaign performance" on a
future request.

---

## Part 4 — The smallest honest first version (if built)

Scoped to Level 2 (Part 2) — spend/performance visibility, no fabricated
attribution:

**Permissions:** `ads_read` only. Not `ads_management` — FieldQuo never needs
to create or modify a contractor's campaigns for this use case, and requesting
`ads_management` when only reads are needed is exactly the kind of
over-broad scope request that slows App Review down further for no benefit.

**Endpoints:**
- `GET /act_<id>/insights` — spend, impressions, clicks, Meta's own reported
  actions/conversions, at the campaign or ad-account level, over a date
  range. This is the one endpoint that actually carries the numbers this
  whole request is about.
- `GET /act_<id>/campaigns` — campaign names/ids/status, to label the
  insights rows meaningfully rather than showing raw campaign ids.
- `GET /me/adaccounts` (or the Business Manager equivalent) — to let a
  contractor pick which ad account to connect, if they have more than one.

**Schema:** extend the existing `MarketingSpend` model rather than building a
parallel one — it already has the right shape (`platform`, `amount`,
`impressions`, `clicks`, `leads`, `conversions`, `date`), and
`marketingRollup.js` already reads it correctly. Add:
- A source marker (e.g. `source: "manual" | "meta_api"`) so a synced row and
  a hand-typed row are distinguishable and a sync job never silently
  overwrites something a human typed.
- `campaignId`/`campaignName` from Meta, stored but — per Part 2 — never
  joined against `LeadRequest` to produce a cost-per-lead figure, because
  that join doesn't exist yet.
- The connection itself: `Company`-scoped token storage as described in
  Part 3.

**What a contractor sees on day one:** a "Connect Meta Ads" action in
Settings (a new small screen, not bolted onto an existing one — payments'
`app/app/settings/payments/page.js` is the closest analogue for the
"connect, show status, disconnect" shape) leading to Meta's OAuth dialog; on
return, a channel card on the existing marketing/spend view showing spend
over time, campaign-level breakdown, and Meta's own click/impression/CTR
figures — clearly labelled as Meta's own numbers, not FieldQuo's. No
cost-per-lead, no "jobs this brought in," nothing crossing into the
attribution claim `featureMatrix.js` currently makes without evidence.

**What ships alongside it regardless of the Meta decision:**
1. The manual `MarketingSpend` entry form referenced in
   `docs/TODO.md:267-270` — date, platform (already includes `facebook`,
   `google`, `tiktok`, `pamphlet`, `referral`, `other`), amount, and
   optionally leads/conversions a human typed in, the same "typed in by
   hand" figure `lib/analytics/kpis.js` already accounts for and refuses to
   overstate. This closes the existing dead `/api/marketing-spend` route,
   makes the monthly digest's marketing section non-zero for the first time,
   and works for every channel in the enum — pamphlets and referrals
   included — not just Meta.
2. **Level 1's blended cost-per-lead** (Part 2): `sum(MarketingSpend.amount)`
   over `count(LeadRequest)` for the period, excluding `manual`/`imported`
   sources and the booking-page funnel (counted separately, not folded in).
   This is what most directly answers "what am I paying per lead across
   everything," needs no Meta access, and can ship the same week as item 1.
3. **`LeadRequest.lostReason`** (Part 2b) — a small schema addition and a
   required-on-loss field in the existing lead-status UI, so "not a real
   inquiry" becomes something a human recorded rather than a heuristic's
   guess, for every channel, not only Meta-sourced leads.

None of these three touch Meta's API, require App Review, or add a
processor to the privacy page — they're the honest, buildable-now half of
what was asked, independent of whether the Meta import itself proceeds.

---

## Part 5 — What it takes to maintain, restated concretely

From Part 0: 3–4 Graph/Marketing API versions per year, a 2-year hard
deprecation floor that Meta has already shown it will cut into early with
off-cycle endpoint blocks (the 47 commerce endpoints blocked on v26.0's
release day; the legacy campaign-creation deprecation reaching *every*
version, including unversioned calls, by 27 Oct 2026).

What that means for FieldQuo specifically, given how the rest of the stack is
run (`lib/ai/provider.js` as the sole OpenAI integration point,
`lib/stripe.js`'s single warning-comment boundary between Connect and
Billing): a Meta integration needs the same discipline — **one file that owns
the Graph API version string and every call to it**, so a version bump is a
one-line change and a single re-test, not a hunt through scattered
`fetch()` calls. Even with that discipline, budget:
- A recurring check (quarterly, matched to Meta's actual release cadence)
  against the developer changelog for field renames/removals affecting
  `insights`/`campaigns`/`adaccounts`.
- Re-running (or at least re-verifying) App Review if the requested
  permission scope ever changes — adding a field, adding an endpoint, can
  trigger this.
- Handling the token-refresh and revocation failure modes from Part 3 as an
  ongoing support surface, not a one-time build item — a contractor changing
  their Meta password, disabling 2FA, or having Meta itself flag their ad
  account will produce a broken connection that shows up as a support
  request, the same way an expired Stripe requirement does today.

This is the honest shape of "not build-once": the endpoints are simple, the
version churn and App Review re-runs are not.

---

## Part 6 — Compliance work

This is a live obligation the moment `ads_read` calls a Meta ad account, not
an afterthought:

1. **A new entry in `lib/legal/processors.js`.** Every existing entry pairs a
   `dataShared` description with a `verify` pattern that
   `scripts/check-legal-pages.mjs` greps for in the real integration code —
   the build fails if the pattern can't be found, which is the mechanism that
   keeps the privacy page honest as the product changes
   (`lib/legal/processors.js:1-11`). A Meta entry needs the same shape: what
   Meta receives (an OAuth token scoped to `ads_read`; which ad account id is
   connected) and what FieldQuo receives back (a contracting company's own ad
   spend, campaign names, and performance figures — **not** homeowner data,
   as long as this stays scoped to Level 2 and never becomes Conversions
   API).
2. **A privacy-policy update** (`app/(marketing)/privacy/page.js`, Section
   4's processor table, which renders `PROCESSORS` directly). The
   check-legal-pages script re-derives its own proof from the real source
   tree, so this can't be added to the policy without a matching, real
   `verify` pattern the code actually satisfies — good, because it means the
   entry can't be written aspirationally ahead of the integration existing.
3. **What flows where, stated plainly for the policy:** a contracting
   company's own Meta OAuth token and ad-account id flow *into* FieldQuo
   (stored server-side, per Part 3); FieldQuo's server calls Meta's Insights
   API on that company's behalf and receives spend/performance figures back.
   **No homeowner data reaches Meta under Level 2** — this is the one clean
   fact that makes Level 2 meaningfully lighter than Conversions API from a
   privacy standpoint, and worth stating in the policy explicitly as the
   boundary, precisely because a future request to "also send conversions to
   Meta" will read as a small extension of an already-approved integration
   when it is really a different, much heavier decision (Part 0).
4. **No data residency claim** — consistent with every other processor in
   the file (`lib/legal/processors.js:24-30`): Meta's API location isn't
   something FieldQuo configures or pins, so the policy shouldn't claim one
   for this integration either.

---

## Part 7 — Recommendation

**Defer the Meta Marketing API import. Build the three things that answer
most of what was actually asked — manual spend entry, blended cost-per-lead,
and a real reason on a dead lead — instead, this week, without Meta. Fix the
false "shipped" marketing claim regardless of what happens next.**

Reasoning, plainly:

- **All three build-now items are already scoped or nearly so, and none
  needs Meta.** The manual entry screen was already scoped by a previous
  pass over this codebase (`docs/TODO.md:267-270`,
  `scripts/check-route-callers.mjs:144-147`) — a form against CRUD that
  already exists and is already permission-checked. The blended
  cost-per-lead figure (Part 2, Level 1) is a `sum()` over one table divided
  by a `count()` over another, both already populated by real data the
  moment the entry screen ships. `lostReason` (Part 2b) is one schema field
  and a required-on-loss prompt in a status flow that already exists. None
  of the three touches Meta's API, needs App Review, Business Verification,
  or a new processor entry — and together they close the exact hole the
  assignment brief opened with (the monthly digest reporting $0 forever) AND
  answer the owner's two follow-up questions (a complete cross-channel
  cost-per-lead, and a real way to separate junk from a real inquiry) more
  directly than the Meta import would on its own.
  This is the "80% of the value for 5% of the cost" case: a contractor typing
  in "$400 on Facebook this week" and marking a dead lead "never responded"
  gets a real, honest blended cost-per-lead and a real junk-vs-qualified
  split, which is most of what "how much am I paying per lead, and how much
  of that is real" actually means to a one-truck operation. It ships in
  days, not weeks.
- **The Meta import, even done well, does not solve the problem the owner's
  own codebase already identified as the real one — and the owner's own
  framing agrees.** `lib/analytics/kpis.js`'s comment is correct: without
  lead-level attribution, a precise-looking spend number is still sitting on
  top of a broken *per-channel* cost-per-lead. Automating the numerator
  while the denominator stays hand-typed and unlinked is visible progress
  that doesn't move the needle on "which channel is working." Level 2
  (Part 2) is the honest version of the import, and it's real, non-zero
  value — but it is strictly additive on top of the three build-now items,
  not a replacement for them, and it costs weeks of App
  Review/Business Verification plus a recurring maintenance tax against a
  3–4-version-a-year API to get there. The owner's request for Meta-side
  "junk cleaning" points toward the *same* heavier Conversions API product
  already deferred in Part 0 — a further reason not to reach for Meta's side
  of this problem first.
- **Timing matters.** `docs/ROADMAP.md` places FieldQuo as "feature-complete
  on the core pipeline, hardening and monetising" — pre-launch, pre-lawyer-review
  on its own legal pages, with real outstanding deployment gaps (documented
  in `docs/VERCEL.md`). Taking on Meta's App Review clock now competes
  directly with that hardening work, for value most of which can ship this
  week without it.
- **If the Meta import happens later, it should happen after, not instead
  of, a decision on Level 3 (real UTM-based attribution, including
  call-tracking for the phone channel).** Building the import first and
  attribution "eventually" all but guarantees attribution never gets built —
  the visible, demoable half will always look done, and the invisible,
  harder half (new capture points on every public form, a matching layer, a
  behaviour change asked of the contractor, a call-tracking build) will keep
  losing to whatever's next on the roadmap. Deciding the attribution question
  first, even if the answer is "not yet," keeps the eventual import honest
  about what it can and can't claim.

**What to do next, concretely, in priority order:**
1. Build the manual `MarketingSpend` entry screen (small, already scoped).
2. Add the blended cost-per-lead figure (Part 2, Level 1) — spend ÷ real
   lead count, company-wide, no attribution claimed.
3. Add `LeadRequest.lostReason` (Part 2b) so "not a real inquiry" becomes a
   number a human recorded, for every channel, not a guess.
4. Fix or soften the `marketing_spend` feature claim in
   `lib/marketing/featureMatrix.js:1166-1182` — it currently promises
   attribution ("against the jobs it actually brought in") that doesn't
   exist regardless of what happens with Meta.
5. Revisit the Meta import if/when either (a) enough tenants are running
   paid Meta ads that manual entry becomes a real chore, or (b) the owner
   decides Level 3 (UTM attribution, plus call tracking for phone leads) is
   worth building — at which point the import becomes worth its App Review
   and maintenance cost, because it would finally be feeding a denominator
   that means something.
