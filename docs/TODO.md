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
| Money flow (income / expenses / what's left, period-over-period) folded INTO the KPI dashboard | `/app/analytics/kpis` | agent building |
| Designer UX — tool rail spacing, mobile layout, AI prompt panel, clone-origin copy | `app/components/designer/` | agent building |
| Navigation sweep — every page reachable, sidebars intuitive | both sidebars | agent building |

## Known unreachable or hard to find — the actual complaint

Pages that exist, work, and have no obvious way in:

- `/platform/voice-webhooks` — built 2026-08-30. Linked ONLY from the phone-pool
  alert on `/platform`. Not in the platform sidebar. If the alert is not showing,
  there is no way to reach it.
- `/app/settings/expense-tracking/import` — reached only from a button on the
  Expense Tracking page. Registered as a drill-in, which is correct, but worth
  confirming the button is findable.
- `/app/analytics/{digest,statements,win-loss,estimate-accuracy}` — no sidebar
  row at all; reachable only from in-page links on the Insights hub. Flagged by
  the nav audit and never resolved.

## Waiting on the owner, not on me

- **Stripe live keys.** Order matters: create both live webhook endpoints first,
  then set all three env vars together, then have the 8 Connect-onboarded
  contractors re-onboard. Doing the key before the webhooks means live events
  arrive with no valid secret and are silently rejected. 11 test-mode
  subscriptions will need re-subscribing; no real money has moved.
- **Suspend/Reactivate on `/platform/companies/[id]`** — the only write path onto
  a customer's own Company row in the whole console. Either a sanctioned
  exception to non-negotiable #3 or a violation. A product call.
- **Photo retention.** Job photos are liability evidence (CompanyCam's own
  benchmark is 7-10 years for structural work) and the product never deletes
  data. Unbounded Cloudinary storage on a flat subscription is a margin problem.
  Needs a stated policy, including what happens on cancellation.

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
