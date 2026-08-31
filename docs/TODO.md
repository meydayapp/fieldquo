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
| Jennifer — FieldQuo's own support/sales assistant, ported from echo | right-hand panel, marketing site + signed-in | agent building |
| Service-gating for trade-specific SETTINGS screens | starting with Cabinet Rates | agent building |
| Past-due grace warning — `graceWarnedAt` exists to dedupe a send nobody built | daily cron | agent building |
| Demo scripts, one 15-min block each: voice, crew, money | `docs/DEMO-*.md` | agents building |
| Read-aloud rewrite of the quote-to-cash script | `docs/DEMO-SCRIPT.md` | agent building |

**Jennifer's scope, corrected by the owner 2026-08-30 and not to be widened:**
she is FieldQuo's tier-1 support and sales assistant — "a tier 1 issue type
conversation to fix something." She does NOT write quotes, price jobs or do work
inside the product. The in-app copilot is a separate product with a separate job
("the ai that is created in a company have specific roles and cannot be
interacted") and must be left alone. Two assistants is correct: the copilot
helps a contractor work, Jennifer helps when something is broken.

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
6. **Google Maps and Google Solar receive homeowner addresses** for roof
   measurement and address autocomplete — a live processor missing from
   AGENTS.md's stack table.
7. **Homeowner IP and user agent are stored** on `Quote.signature` and
   `ServicePlanAuthorisation`, with no retention path. IP is personal data in
   most frameworks.
8. **No data residency is established in code** for any processor. A policy
   naming a country would be inventing a fact.
9. **No cookie banner, no sub-processor list, no DPA** anywhere in the repo.

Fixed 2026-08-30: the receptionist now tells callers the call is recorded.

## Planned, not started
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
