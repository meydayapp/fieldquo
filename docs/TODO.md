# Open work

The tracking file. The owner asked twice for the navigation sweep and it was
lost twice between turns, so it lives here now rather than in a conversation.

**Rule: nothing is "done" until a human can reach it by clicking.** Building a
page, wiring its API and passing `check:all` proves the code exists. It does not
prove anybody can find it. Every bug the owner found on 2026-08-30 lived in that
gap.

## In flight

Raised 2026-08-30. Nothing here is done until a human can click it and see it
behave.

**Blocks the owner's next demo — fix first**

| What | Detail |
|---|---|
| Onboarding let a NON-CREW person be added as an employee | Seats read 1/1 used, 0/5 crew. The picker offered someone who is not crew. |
| A deleted employee still appears in Payroll | "Jonny" was deleted and is still there. Should be ARCHIVED, not deleted — and if re-added, does the history come back? The product norm is that nothing is ever destroyed. |

**Instant quote is missing what the normal quote builder does**

| What | Detail |
|---|---|
| Tax | It creates the client, then says it "can't work out the client's tax" and leaves tax off the quote entirely. |
| Costing | Not attached automatically; has to be entered by hand afterwards. |
| Assigned employee | No way to pick one, unlike the normal builder. |

**Services that appear without being chosen**

Kitchen design behaves like a permanent button rather than a service a company
offers. Countertops and stairs show up too, on companies that never selected
them. New kitchen installs are done by several trades and NOT by every cabinet
refinisher — the catalogue must follow what a company actually sells.

**Copy that does not explain itself**

- `/app/settings/material-costs` — for a consumable, "units" is ambiguous. Is it
  per roll? Rolls per pack? What does the price refer to? Same for masking film.
  And there is no obvious place to say how much material a small / medium /
  large job consumes.
- `/app/settings/overhead` — the arithmetic needs checking against a real
  company (Pro Painter Inc), and it is unclear where BILLS DUE belong, or
  whether they are only a statistic.

**Legal, owner-approved to build**

| What | Why |
|---|---|
| Public unsubscribe route in every commercial email | CASL requires a working unsubscribe. Today `MarketingSubscriber.subscribed` is staff-only behind `user:manage`, and no public route exists. Sharpest exposure in the product. |
| Homeowner STOP handling | Appointment reminders promise "Reply STOP". The only inbound SMS webhook is the crew line. A homeowner's STOP reaches nothing FieldQuo owns. |

**Also**

A 15-minute demo script, ordered so the numbers make sense — overhead, material
costs and services have to be filled in before a quote demo shows anything real.
Audience: a solo painting company covering one employee.

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
