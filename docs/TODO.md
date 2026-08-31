# Open work

The tracking file. The owner asked twice for the navigation sweep and it was
lost twice between turns, so it lives here now rather than in a conversation.

**Rule: nothing is "done" until a human can reach it by clicking.** Building a
page, wiring its API and passing `check:all` proves the code exists. It does not
prove anybody can find it. Every bug the owner found on 2026-08-30 lived in that
gap.

## In flight

| What | Where | State |
|---|---|---|
| Drag-to-reorder on the Leads board | `/app/leads` | agent building |

## Landed overnight, 2026-08-31

**Job photo record.** `stageTimeline()` in `lib/gallery/albums.js` — the office
twin of `albums()`, and the one function in that file that does NOT filter.
Unfeatured photos and `issue` shots are exactly what a contractor needs in a
dispute, so the timeline keeps them while every public view still drops them.
Executed against a hostile fixture to confirm both halves: 3 of 3 photos in the
timeline, 1 of 3 in `albums`, and `beforeAfterPairs` correctly empty when the
"after" is unfeatured. A photo-report PDF hangs off it, reusing the existing
`@react-pdf` pipeline and the company's own brand theme, scoped by company AND
`assignedJobWhere` so a crew member restricted to their own jobs cannot pull a
report for somebody else's.

Photo-to-quote-line-item was scoped OUT rather than half-built, and the reason
is good: line items inside `QuoteScopeGroup.lineItems` have no stable id, and
`PATCH /api/quotes/[id]` replaces that JSON array wholesale. Any photo
reference by id would silently orphan on the next quote edit. That needs a
schema decision mirroring the existing `QuoteImport.targetLineId` reconciliation
one level up.

**Visit status.** See "a route with no caller" below.

**Demo scripts** for marketing/growth and job execution — the last two blocks.

## Landed overnight 2026-08-30

Jennifer (support assistant, text only, escalation lifecycle) · past-due grace
warning, two notices, empathetic register · renewal reminders (7 day monthly,
30 day annual) · crisis handling on every AI surface · privacy policy, terms and
a security page · trade-gated settings screens · CASL unsubscribe and real STOP
handling · instant quotes carry tax, costing and an assignee · seat guard on
onboarding · workers archived not destroyed · kitchen/countertop/stairs gating ·
the starting credit described as $10.50, not "30 free minutes" · demo scripts for
quote-to-cash, voice, crew and money, all read-aloud.

## Reachability — swept 2026-08-30, and now guarded

Every page under `app/app` (97) and `app/platform` (24) is a sidebar row, a
named drill-in with a stated reason, or an explicit exclusion with one.
`scripts/check-nav-audit.mjs` fails the build if a new page slips through, in
either tree — so this cannot silently rot again.

Closed in this sweep:

- `/platform/voice-webhooks` — was linked ONLY from the phone-pool alert on
  `/platform`, so with no alert showing there was no way in. Now has a sidebar
  row.
- `/app/analytics/{digest,statements,win-loss,estimate-accuracy}` — kept as
  drill-ins off the Insights hub rather than four more rows, each with its
  inbound link named. Documented rather than silent, which was the actual
  complaint.
- An independent second pass re-verified every drill-in by grepping for the
  route literal rather than trusting the comment, and found no dead links and no
  stale entries.

## Decide before the next demo — two live pricing models

Both are in production code and they disagree about what a one-person company
pays.

| Path | Price | Used by |
|---|---|---|
| Tier ladder (`lib/pricing/ladder.js`) | **Solo $99** — 1 seat + 5 crew | the public pricing page, the seeded Plan rows, the signup tier buttons |
| Per-licence (`lib/pricing.js`) | **$45/licence** flat, 1-9 | signup's headcount path, the "Add licences" upgrade, the billing checkout route, `PricingCard`, `salesKnowledge` |

TWO LIVE PRICING MODELS is not automatically a bug — one is pick-a-tier, the
other is buy-N-licences, and the database has a real `Custom (2 employees)
$90.00` row that is 2 x $45. But a prospect asking "what does it cost me, I'm on
my own" gets **$45 or $99 depending on which door they came through**, and the
demo scripts quote different figures because the code does.

The sales knowledge base quotes the per-licence number, so FieldQuo's own sales
agent is saying $45.

Decide which is the price. The docs and scripts follow.

## Waiting on the owner, not on me

- **Stripe live keys.** Order matters: create both live webhook endpoints first,
  then set all three env vars together, then have the 8 Connect-onboarded
  contractors re-onboard. 11 test-mode subscriptions need re-subscribing; no
  real money has moved.
- **Suspend/Reactivate on `/platform/companies/[id]`** — the only write path onto
  a customer's own Company row in the console. Sanctioned exception to
  non-negotiable #3, or a violation. A product call.
- **A named privacy officer.** Quebec Law 25 requires the title and contact be
  PUBLISHED on the website once you hold a Quebec resident's data. By default the
  role falls to whoever holds highest authority. There is no such disclosure
  today.
- **Legal review** of anything drafted below before it is published.

## Legal and privacy — found 2026-08-30, ranked by exposure

The data-flow audit turned these up. Ranked worst first.

1. **CASL: no unsubscribe in any email.** `MarketingSubscriber.subscribed`
   exists and is honoured before sending, but toggling it needs `user:manage` —
   it is staff-only, and there is no public unsubscribe route anywhere.
   Canada's anti-spam law requires a working unsubscribe mechanism in commercial
   electronic messages. This is the sharpest legal exposure in the product.
2. **"Reply STOP" is promised with nothing behind it.** Appointment reminders
   tell homeowners to reply STOP. The only inbound SMS webhook is the crew line,
   matched on `CrewInboxNumber` — a homeowner's STOP is not processed by
   FieldQuo at all. It may be handled at the Twilio account level; that is not
   verifiable from the repo and must not be claimed until confirmed.
3. **No retention limit on call recordings or transcripts.** No cron, no expiry
   field, no deletion path. Combined with "nothing is ever deleted", a homeowner's
   recorded call is kept indefinitely.
4. **No company-deletion path exists at all** — not self-serve, not admin. A
   contractor asking to be deleted has no backend flow.
5. **No homeowner-facing data surface.** The client portal shows invoices only.
   No access, correction, export or deletion for the person whose name, address,
   photos and recorded call are held.
6. ~~**Google Maps and Google Solar receive homeowner addresses**~~ — closed
   2026-08-31. Both are in the published sub-processor list and now in
   AGENTS.md's stack table, alongside Unsplash, which had the same problem.
7. **Homeowner IP and user agent are stored** on `Quote.signature` and
   `ServicePlanAuthorisation`, with no retention path. IP is personal data in
   most frameworks.
8. **No data residency is established in code** for any processor. A policy
   naming a country would be inventing a fact.
9. **No cookie banner and no DPA.** The sub-processor list is closed:
   `lib/legal/processors.js` names all 14, the privacy page renders them, and
   `scripts/check-legal-pages.mjs` fails the build if any entry's integration
   disappears. Added 2026-08-31: **Unsplash**, because a new company site
   hotlinks stock photos rather than copying them, so a homeowner's browser
   fetches from Unsplash and Unsplash sees their IP; and **YouTube**, for the
   no-cookie embed on FieldQuo's own industry pages. Both were real third-party
   requests made by a page a member of the public loads, and neither was
   disclosed.

Fixed 2026-08-30: the receptionist now tells callers the call is recorded.

## Found and closed 2026-08-31 — a route with no caller

`JobVisit.status` was written once, at creation, and nothing in the product
could change it again. `grep on_the_way` returned exactly one file: the route
that reacts to it. The only client that ever PATCHed a visit was the checklist,
which sends `checklistItems` and nothing else.

Stranded by that, all correct in source:

- the **"on my way" text** to the homeowner — with editable wording at
  `/app/settings/messages`, under a header saying it is the one message that
  really sends;
- **`ensureUpcomingVisit`** on completion, so a recurring job's next visit
  waited for the nightly cron instead of appearing as the crew closed out;
- the job page's **"0 of 3 complete"** counter, which could never move.

Now: `lib/jobs/visitStatus.js` (the transitions and the label map),
`app/components/jobs/VisitStatus.js` (the buttons, which name the text on the
button and say where it goes), and `scripts/check-visit-status.mjs`, which asks
the question no check in the repo asked — **does this route have a caller?**

## Routes with no caller — swept 2026-08-31

The visit-status bug (above) was a route nothing called. So the same question
got asked of all 167: for each `app/api/**/route.js`, does its static path
prefix appear anywhere outside `app/api`? Nine came back. Five are the cron
endpoints, all present in `vercel.json`. One is a Stripe return URL built by a
sibling route. That leaves three, and they are two separate findings.

**Fixed.** `app/api/invoices/versions/route.js` lived one directory too high.
Every line inside it read `_params.id`; there was no `[id]` segment to provide
one. Prisma drops an `undefined` from a where clause rather than matching
nothing, so it returned whichever invoice came back first for the company and
reported *its* version chain — tenant-scoped, so nothing crossed companies,
just the wrong invoice every time for anyone who found the URL. Moved to
`app/api/invoices/[id]/versions/route.js`, which is what its own header comment
had said since the first commit. `check-rbac-redaction.mjs` had been asserting
this route redacts money, which it does; nobody had asked whether it worked.

Then the sweep was made a build check — `scripts/check-route-callers.mjs` —
and stripping comments before matching turned up **six more**. Every one had
looked reached because a file's own prose named the route it was about to
call, or fail to. Two were the Stripe webhooks, which are registered in
Stripe's dashboard and can have no in-app caller. Four were real, and are now
declared in the check with the reason, rather than suppressed:

| Route | Why it has no caller |
|---|---|
| `/api/marketing-spend` | `MarketingSpend` is READ — `lib/analytics/marketingRollup.js` feeds the monthly digest from it — and **no screen writes it**, so the digest reports zero spend forever. Small build: date, platform, amount. |
| `/api/analytics/burn-rate` | Already documented in `lib/permissions/costBasis.js`. Monthly burn and runway. The numbers exist on the Overhead screen; this presentation of them has no page. |
| `/api/analytics/pricing-benchmark` | A second door onto what `/api/analytics/benchmark` already serves. |
| `/api/leads/public` | `app/quote/[companySlug]/page.js` was built to give this and `/api/self-quote` a home; only the self-quote half was wired. The public quote form works — the page's header comment just overstates what it closed. |
| `/api/feedback` | Documented in `lib/supportContact.js`: the console reads what it writes, nothing in `/app` renders a form, which is exactly why `SUPPORT_EMAIL` points at an inbox a human answers. |
| `/api/ai/quote-suggestions` | An HTTP wrapper around `lib/ai/quoteSuggestions.js`, which IS used — `quoteReview.js` calls it in process. |

**Built.** `/platform/voice-economics` — the endpoint computed the per-minute
margin, the number-rental spread, the concurrency bill nobody is charged for
and the break-even minutes on a slot, and no screen called it. Now a page, with
a sidebar row, and the shared call pool given its own panel ABOVE the money:
a full pool is not a margin problem, it is an inbound call waiting forty
seconds and then failing, which the homeowner experiences as a contractor who
does not answer their phone.

**For the owner: Good/Better/Best quote tiers are a whole feature with no
front door.** `Quote.tierGroupId` and `Quote.tierLabel` are in the schema.
`POST /api/quotes/tier-group` creates the linked trio. `GET
/api/quotes/versions` returns it, sorted so "best" does not sort first and
break the anchoring. `GET /api/quotes/tier-group/[tier-group]` exists too.
`lib/analytics/winLoss.js` and `lib/analytics/kpis.js` both collapse a trio
into one homeowner decision so the win rate is not diluted.

Nothing in `/app` calls any of it. No screen creates a trio and no screen shows
one. (`QuoteBuilder`'s `selectTier` is unrelated — it labels a line inside one
scope group.) The analytics are correctly handling data that cannot exist.

Not built tonight because the missing half is a product decision, not code:
three quotes have to reach the homeowner somehow, and `/q/[token]` presents one
quote and takes one signature. Either the client page grows a comparison with
one approval across three, or a trio is an internal drafting aid and only the
chosen one is ever sent. Those are different products. Deciding is a minute;
guessing costs a rebuild.

## Planned, not started

- Job-site photo documentation beyond intake: internal before/during/after
  timeline, annotation, photo reports. `JobPhoto`'s stated purpose in its own
  schema comment is still the public website gallery, not a liability record.
- Drag-to-reorder on the Leads board. The board, columns, cards and status
  endpoint all exist; only the drag interaction is missing. Use `@dnd-kit`
  (React 19), never `@hello-pangea/dnd`. A drop into "Converted" must go through
  the real conversion endpoint, which also creates a Quote — not a bare status
  PATCH.
- Plaid, when there are enough paying companies to amortise a $1,000+/month
  floor — roughly 100 connected accounts at break-even, comfortable at 200-300.
  CSV import is the deliberate stand-in and is built so Plaid is a backfill:
  every row records its source, and the duplicate key is source-blind.

## Deliberately not built

- Job-stage board. `JobStatus` is inferred from real events — visits starting,
  time entries closing. Dragging a card to "Completed" would flip the status
  without the facts underneath it and skip the review-request and payroll logic
  that depends on that transition happening for real.
- A native mobile app, and therefore CompanyCam's camera-first capture, GPS
  tagging and offline sync. Honest about it rather than shipping a web
  imitation.
