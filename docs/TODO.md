# Open work

The tracking file. The owner asked twice for the navigation sweep and it was
lost twice between turns, so it lives here now rather than in a conversation.

**Rule: nothing is "done" until a human can reach it by clicking.** Building a
page, wiring its API and passing `check:all` proves the code exists. It does not
prove anybody can find it. Every bug the owner found on 2026-08-30 lived in that
gap.

## In flight — 5 agents, night of 2026-08-31

| What | Where | State |
|---|---|---|
| Meta ad spend + insights | `lib/meta/`, marketing KPIs | building |
| Publish a design to Instagram / Facebook | Marketing Designer | **landed** |
| Mobile sweep — client-facing pages | `app/quote`, `book`, `q`, `portal`, `site` | **landed** |
| Mobile sweep — back office | `app/app/**` | **landed** |
| KPI empty states | — | **landed** |
| Crisis rule → 911 | every AI surface | **landed** |

### Lost, and re-dispatched

Five agents ran a long time on the night of 2026-08-30 and produced **no
branch and no commits**: four mobile sweeps and the crisis rule. The crisis
rule has since been rebuilt and landed. Two of the four mobile sweeps are
re-dispatched and have since landed. **Still outstanding:** the dense-screens
sweep (settings, analytics, the Marketing Designer, `/platform`) and the mobile
regression check that would guard all of this from coming back.

Also still outstanding, and named so it is not mistaken for done: **nothing in
any of the mobile work has been seen rendering on a real device.** Every fix is
verified at the code and build level only. Both audit docs say so.

The lesson is procedural: an agent reporting a long run is not evidence of
work. Check `git rev-list --count main..<branch>` before believing a summary.

## In flight

Nothing. Everything dispatched overnight has landed and been verified.

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

**Drag-to-move on the Leads board** — `@dnd-kit/core`, already a dependency.
Separate drag handle from the click-to-open button so keyboard Space/Enter does
not fight the native click; Mouse/Touch/Keyboard sensors rather than one
Pointer sensor, so a touch-scroll on the single-column mobile board is not
mistaken for a pickup.

The trap was the drop into "Won". The decision was to REFUSE it rather than
auto-convert — creating a real quote row from a slide gesture is a side effect
nobody asked for, and it would not make the lead won anyway, only quoted. The
rule lives in one pure function, `canSetLeadStatus` in `lib/leads/pipeline.js`,
enforced server-side in BOTH PATCH routes with a 409, not just in the drag
handler. Executed against hostile input: no quote refused, `quoteId: ""`
refused, `null` lead refused, a bogus status refused, and lost/contacted
unaffected.

The same hole was already open on the drawer's own "Won" button, which PATCHed
the enum with no check at all. It got the same guard.

The rule is "a quote exists", not "a quote was accepted" — a contractor who
gets a yes on the phone must be able to record it. What is refused is a win
with nothing priced behind it, which is the one a drag board makes easy and
which sits in the win-rate number forever. The module comment overstated this;
corrected on merge.

Not done: dnd-kit's screen-reader drag announcements are still English-only.
Keyboard dragging works; the live-region text is not routed through `t()`.

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
| ~~`/api/marketing-spend`~~ | **Built 2026-08-31** — `app/app/marketing/spend/page.js`. See `docs/META-ADS-BUILD.md` and the "Recently completed" entry in `docs/ROADMAP.md`. Removed from `NO_FRONT_DOOR` in `scripts/check-route-callers.mjs`. |
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

- Photo annotation — drawing on a job photo. Deliberately left out of the photo
  record above: there is no canvas tooling in this repo, and the caption field
  covers most of what an arrow would.
- Photos attached to a quote LINE ITEM. Blocked on schema, not effort: line
  items inside `QuoteScopeGroup.lineItems` have no stable id and
  `PATCH /api/quotes/[id]` replaces that JSON array wholesale, so a photo
  referencing one by id orphans on the next edit. Needs a stable line-item id
  and a reconciliation pass, mirroring `QuoteImport.targetLineId` one level up.
- Screen-reader drag announcements on the leads board. dnd-kit's defaults are
  English-only and not routed through `t()`. Keyboard dragging itself works.
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

## Crisis rule, simplified 2026-08-31

`lib/ai/crisisRule.js` was rewritten to the owner's exact instruction: "The ai
should always tell people to call 911. Keep it simple. It is an emergency and
they call 911 related to the job then continue with quote booking or related
to the business." This note exists so nobody reinstates the elaborate version
from old prose in a future pass — read this before touching that file again.

**What it says now.** One rule, `CRISIS_RULE`, covering BOTH a job-site
emergency (gas, fire, a live wire, water through a ceiling, someone hurt on
site) and a personal one (a caller who says something that plainly means they
or somebody else is in danger) with the SAME answer: say, once, calmly, that
they should call 911 — then continue the conversation exactly as it would have
gone anyway. Not a welfare check, not repeated, not a reason to end the call or
stall. Still imported verbatim by every surface whose words reach a person:
`lib/voice/prompt.js`, `lib/voice/outboundPrompt.js`,
`lib/platform/salesPrompt.js`, `lib/ai/copilotClient.js`.

**What was removed, on purpose:**

- **988** (the US/CA Suicide & Crisis Lifeline). One destination only, per the
  owner's words — not two, however good the second one is on its own.
- **The instruction to stop the call.** The old rule told the model to drop
  everything — no more intake, no more booking — "none of it matters right
  now". The new one says the line once and gets back to work. A homeowner who
  mentions a gas smell and then wants to book a Tuesday gets their Tuesday.
- **The separate property-emergency rule.** `lib/voice/prompt.js` rule 5 and
  `lib/voice/outboundPrompt.js` rule 6 used to carry their own "gas, fire,
  flooding, sewage" wording ahead of the personal-danger rule (5b/6b). Both are
  now just `${CRISIS_RULE}` — one merged rule, not two adjacent ones.
- **The counselling-shaped language** — "do not diagnose", "do not counsel",
  "never promise to pass a message". The old rule was trying to be a small
  amount of crisis support; the new one isn't, and pretending to be fuller than
  "here is the number to call" would be its own kind of dead control.

**The downstream batch jobs now FLAG instead of REFUSING.**
`lib/ai/callQuoteDraft.js` and `lib/ai/callLeadRecovery.js` read a FINISHED
transcript after the call to build a quote draft or recover a lead. Under the
old rule, a crisis mention meant the live agent had stopped the call outright,
so a flagged transcript genuinely had nothing usable in it and refusing to
draft/recover cost nothing. Under the new rule the live agent continues, so
the same transcript is likely to carry a real quote or a real lead sitting
right after the crisis line — refusing now would silently cost the contractor
a job the caller was gone by the time anyone noticed. So both files still run
`mentionsCrisis()` before spending a model call, but a match now sets
`needsReview: true` (the same flag `save_caller` sets for a property
emergency) and falls through to draft/recover normally, instead of returning
early. `DRAFT_REASONS.CRISIS_DETECTED` and `RECOVERY_REASONS.CRISIS_DETECTED`
were removed as a result — nothing produces that reason any more — along with
the two now-dead i18n keys (`app.receptionist.noDraft.crisis_detected`,
`app.callDraft.reason.crisis_detected`) and the special-case in
`lib/voice/autoDraft.js` and the manual draft-quote route that used to promote
that reason into a flag.

`mentionsCrisis()` itself is unchanged — still scoped to personal-danger
phrasing only ("kill myself", "suicidal", etc.), not property words like "gas"
or "fire", which end in a real, priced job constantly and would flood the
review queue if they tripped the same gate.

`scripts/check-crisis-handling.mjs` was rewritten to match: it proves 911-only
(every digit sequence in the rule is exactly `{911}`), proves the rule tells
the model to continue rather than stop, proves every surface still carries it
verbatim, and proves — by real execution with injected fakes for lead recovery
and a comment-stripped source scan for quote drafting — that a crisis
transcript is flagged AND still produces a lead/draft, not refused. Every
assertion in it was mutation-tested by hand (13 separate mutations: the digit
check, the stop-language check, the continue/welfare-check language, a missing
surface, a reintroduced property paragraph, a reintroduced early refusal in
each downstream file, a reintroduced dead reason constant, a reintroduced dead
i18n key, a weakened and an over-broadened `mentionsCrisis()`, and a
hostile-notes ordering regression) and each one was caught.
