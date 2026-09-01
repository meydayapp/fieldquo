# Invoice date, and a job you can schedule without a visit

Two gaps the owner found. Both turned out to be real, and both were narrower
than they first looked — most of the surrounding machinery already existed.
This document says what was already there, what was added, and what was
deliberately left alone.

---

## 1. "Currently an invoice doesn't have a date"

### What was already built (found, not added)

This is a well-developed area of the codebase. Before touching anything:

- `Invoice.dueDate` exists, is settable from both `/app/invoices/new` and the
  edit page, is validated and stored, and is already rendered — labelled
  "Due date" — on the PDF (`ClientInfoSection`), in the invoice email
  (`lib/email/invoiceEmail.js`), on the app's own invoice detail page, and on
  the client portal (`PortalInvoice.js`).
- `Invoice.createdAt` is rendered as "Date" on the PDF's `ClientInfoSection`
  and on the app's invoice detail page.
- `lib/analytics/receivables.js` already has a documented `undated` state for
  invoices with no due date, and `lib/invoices/lifecycle.js` already refuses
  to call a draft "overdue".
- **Two dead fields**: `Invoice.startDate` / `Invoice.endDate` exist in the
  schema and are read and written **nowhere** — not the same feature as the
  job dates below, just an orphaned pair of columns from something else.
  Left alone; flagged here rather than fixed quietly, since removing a schema
  field is a decision, not a cleanup.
- **A closed decision worth knowing about**: `lib/servicePlans/run.js` already
  considered computing a due date from `Company.paymentTerms` and explicitly
  declined — the comment reads *"Company.paymentTerms is free text ('50% on
  completion'), not a day count, so there is no net-N to add here; and
  inventing one would put a date on the document that nobody agreed to."*
  `paymentTerms` is confirmed free text (grepped; no `netDays` / structured
  terms field exists anywhere in the schema). This fix honours that decision
  and does **not** add net-day parsing.

### The actual gap

`app/portal/[token]/invoices/[id]/PortalInvoice.js` — the page a homeowner
opens from their payment link, the one client-facing surface built for
*paying* an invoice rather than just downloading it — showed the invoice
number, the line items, the total, and a due date *if one happened to be
set*. It never showed an issue date. `invoice.createdAt` was already in the
payload (`app/api/portal/[token]/route.js` spreads the whole invoice) and
simply wasn't read by the component. Hypothesis A from the brief: **the date
existed in the data and wasn't rendered.**

Separately, hypothesis C was also partly true: the PDF and the app's own
detail page did show a date, but it was always `createdAt` — a draft raised
in March and actually emailed in May printed a March date, because nothing
distinguished "when the row was made" from "when the client was actually
told this figure."

### What was added

**No schema change.** `Invoice.sentAt` and `Quote.sentAt` already exist and
are already written by exactly one thing each: the send route, *after*
Resend accepts the message (both routes' own header comments say so almost
verbatim — this is a pattern the codebase already enforces on purpose). That
is already the definition of "issued" this product uses everywhere else, so
this reuses it instead of adding a column:

- **`lib/documents/issueDate.js`** (new) — `documentIssueDate(doc)` returns
  `doc.sentAt || doc.createdAt || null`. One function, used everywhere a
  document needs "the" date.
- **`lib/documentSections/HeaderSection.js`** and **`ClientInfoSection.js`**
  (shared by quotes *and* invoices) now call it instead of reading
  `data.createdAt` directly. Quotes are unaffected in practice — `Quote` data
  simply has no `sentAt` in most call sites the way `Invoice` does, so it
  falls back to `createdAt` exactly as before — but the fix is correct for
  either document type if a caller ever passes `sentAt` through.
- **`app/app/invoices/[id]/page.js`** — the "Date" fact now reads
  `documentIssueDate(invoice)` instead of bare `invoice.createdAt`.
- **`app/portal/[token]/invoices/[id]/PortalInvoice.js`** — now shows the
  issue date next to the invoice number, labelled with the existing `Date`
  string from `documentLabels.js` (already translated in all six document
  languages — no new translation keys needed for this half of the fix).

**Fallback, not backfill.** No existing row was touched. A row with no
`sentAt` (settled in person, never emailed) falls back to `createdAt`, which
is the honest answer for that case — it really was only ever dated by when
it was raised.

### Verified

- `npm run check:document-dates` (unchanged — it tests timezone formatting of
  calendar dates, not this) — still green.
- `npm run check:document-money` — still green; it specifically asserts
  `HeaderSection`/`ClientInfoSection` stay currency-free, which this change
  doesn't touch.
- Manual read-through of `app/api/invoices/[id]/pdf/route.js` and
  `app/api/portal/[token]/route.js` confirms `sentAt` is already present on
  every object `documentIssueDate` is called with — no query changes needed
  for this half.

---

## 2. A job that only has visits, not a schedule

### What was already built

- `JobVisit` — a trip to an address, with assignment, a checklist, photos.
- `POST /api/jobs/[id]/visits` already flips a job from `unscheduled` to
  `scheduled` on its first visit, and already resolves the "schedule this
  job" task the quote-acceptance flow raises. Both patterns are mirrored by
  the new code below rather than reinvented.
- `docs/TODO.md`'s "Deliberately not built" note on a job-stage board is
  real and still correct: `JobStatus` is meant to be inferred from actual
  events, not dragged. This fix follows that rule rather than working around
  it — see below.
- **`Job.status` defaults to `scheduled` in the schema**, but every real
  creation path (`lib/jobs/createJobFromQuote.js`) sets it explicitly to
  `"unscheduled"`. `lib/jobs/createJob.js` (used by `POST /api/jobs` and the
  invoice's "create a job" button) sets neither, so it silently relies on the
  schema default of `scheduled` — a job with no visit and no dates, created
  by hand, starts life claiming to be scheduled. This predates this fix, is
  arguably its own bug, and was left alone: fixing it changes what every
  hand-created job's initial status is, which is a product decision, not a
  scheduling feature.

### What was genuinely missing

`Job` had no start or end date of its own. The only way to put a date on a
job was `JobVisit.scheduledAt` — a trip to the address. A two-week repaint
with no site visit of its own had no way to be "scheduled" except by lying
about a visit that wasn't really one.

**The banner was worse than just incomplete — it actively steered wrong.**
Two places said "book a visit" for a job that might not need one:

1. `app/app/jobs/[id]/JobDetail.js` — the "needs a date" banner, one button:
   *Schedule a visit*.
2. `lib/invoices/lifecycle.js` — the exact banner the owner was looking at
   when he raised this: an invoice linked to a job with no visits raised a
   `jobUnscheduled` banner reading *"{title} has no visit booked."*,
   regardless of whether the job needed one. This is very likely the literal
   sentence he saw.

### What was added

**Schema** (`prisma/schema.prisma`, `Job` model):

```prisma
startDate DateTime?
endDate   DateTime?
```

Both nullable and independent. A start with no end is a job that has begun
and hasn't been given a finish date — common (weather, scope changes) and
not something to force a guess at. An end with no start is rejected by the
API. `npx prisma validate` passes; **`prisma db push` was NOT run**, per
instructions — the owner deploys that.

**Validation** — `lib/jobs/validateJobDates.js` (new, pure):

- End with no start → rejected.
- End before start → rejected.
- A span over 366 days (the ceiling itself is accepted — a real project can
  span exactly one calendar year, leap day included) → rejected as almost
  certainly a mistyped year.
- Unparseable input → rejected, not silently dropped.
- `""` / `null` → treated as "clear the field", not an error.

Enforced in `PATCH /api/jobs/[id]/route.js`, which merges the incoming
`startDate`/`endDate` with whatever the row already has for the field this
request *didn't* touch, so sending only `endDate` is still validated against
the real resulting state. Also checked client-side in the edit form for
instant feedback — the server is still what actually decides.

**The status transition mirrors the visits route exactly**: giving a job a
start date flips it from `unscheduled` to `scheduled`, only from
`unscheduled` (so a completed/cancelled job correcting its dates isn't
dragged backwards), and only when the same request isn't *also* setting a
status explicitly. It also resolves the "schedule this job" task, the same
event a first visit already closes. **Nothing here lets anyone mark a job
`in_progress` or `completed` from a date** — that dropdown already existed
before this change and is untouched; this only ever writes `scheduled`,
which is exactly the event-inferred rule `docs/TODO.md` asks for.

**UI**:

- `app/app/jobs/[id]/edit/page.js` — two new date inputs, "Work dates",
  disabled end-date field until a start is set, inline validation error,
  save button disabled while invalid.
- `app/app/jobs/[id]/JobDetail.js` — the "needs a date" banner now offers
  **both** "Schedule a visit" and "Set dates" (→ edit page), translated. A
  new card shows the job's own date range whenever it's set, independent of
  the banner. Every visit row gets a small "Outside job dates" flag if its
  `scheduledAt` falls outside the job's range.
- `lib/invoices/lifecycle.js` — the `jobUnscheduled` banner (*"has no visit
  booked"*) no longer fires when the job has its own `startDate`. A job with
  dates and zero visits now raises **no banner at all** — dates are treated
  as a complete answer, not a lesser one that still needs a warning attached.
- `app/api/invoices/[id]/lifecycle/route.js` — `JOB_SELECT` now actually
  loads `startDate`/`endDate`. Without this the lifecycle.js fix above would
  have been correct and silently useless — the column the banner needed to
  check would never have reached it.
- `app/app/invoices/[id]/JobPanel.js` — now shows the job's date range (when
  set) next to its title/status, so the exact screen the owner was reading
  from shows the schedule instead of just the absence of a visit.

**How the "needs a date" banner now resolves**: `job.status === "unscheduled"`
is unchanged as the condition — it's still the single source of truth — but
it is now satisfied by *either* door: a first `JobVisit`, or a `startDate`.
Both flip the same status the same way, so the banner cannot lie by only
knowing about one of them.

### The calendar decision — deliberately not built

`/app/appointments` was read in full before deciding. It is built entirely
around **point-in-time entries** (`scheduledAt`, grouped by `dayKey`) merged
from `Appointment`, `JobVisit`, and `Booking` — see
`lib/schedule/jobVisits.js`'s `mergeSchedule`. A job's start/end is a
**multi-day span**, and there is no rendering slot for a span in a
day-grouped list without building something closer to a Gantt/range view —
a distinct, much larger feature, not a natural extension of this one.

**Decided against** adding it to the calendar for that reason. What *was*
built instead, and is cheap and low-risk by comparison: `lib/jobs/visitInRange.js`
flags a `JobVisit` whose day falls outside its job's `[startDate, endDate]`
on the job detail page. It's a nudge, not a rule — a pre-job assessment
visit legitimately happens before `startDate`, and a warranty callback
legitimately happens after `endDate`, so nothing is blocked, only flagged.
A job with no `startDate` flags nothing (there's no range to be outside of).

### Mutations run (and what they caught)

Every pure function below was executed against hostile input, and every
assertion was mutation-tested — broken on purpose, confirmed to fail, then
restored (backed up with `cp`, restored with `cp`, never `git checkout`).

- **`validateJobDates`**: flipped `end < start` to `end <= start` → the
  same-day-job test failed, as expected. Tightened the 366-day ceiling by 10
  days → the boundary test failed, as expected. Restored; all 84→+18 new
  assertions green.
- **`isVisitOutsideJobRange`** (`lib/jobs/visitInRange.js`): hostile-input
  testing found a **real bug** before it shipped — `new Date(null)` is a
  *valid* date (1970-01-01 UTC), not `NaN`. The first version of
  `utcDayNumber` didn't guard for `null`/`undefined`/`""` before calling
  `new Date()`, so a job with **no** dates at all read as "everything is
  after 1970" and flagged **every visit on every job that simply hadn't been
  given a range yet** — the exact opposite of "a nudge, not a rule". Fixed by
  checking for a missing value before constructing the `Date`. Confirmed the
  fix by reverting it and watching three assertions fail, then restoring.
- **`lib/invoices/lifecycle.js`**: reverted the `!job.startDate` guard on the
  `jobUnscheduled` banner → the three new banner tests failed, confirming
  they'd catch a regression of the exact bug this task was filed for.
- **`app/api/invoices/[id]/lifecycle/route.js`**: removed
  `startDate`/`endDate` from `JOB_SELECT` → the new source-scan assertion in
  `check-visit-status.mjs` failed, confirming it would catch the "fixed the
  logic, forgot to load the column" class of bug this codebase is swept for
  repeatedly.

All assertions were added to **existing** check scripts, per instructions —
no new entry was added to the `check:all` chain:

- `scripts/check-visit-status.mjs` — new §6, ~30 assertions:
  `validateJobDates`/`parseDateOrNull` hostile-input cases, `isVisitOutsideJobRange`
  hostile-input cases, and source-scans confirming the route calls the
  validator, the status-transition rule and task-resolution exist, the
  `JOB_SELECT` fix is in place, and the job page actually surfaces the range
  and the flag rather than only computing them.
- `scripts/check-invoice-banners.mjs` — three new cases: a job with dates and
  no visits raises no `jobUnscheduled` banner, raises *nothing at all*, and a
  start-with-no-end-yet still counts as scheduled.

### Verified

- `npx prisma validate` — passes. `prisma db push` **not** run.
- `npm run check:all` — 226 scripts, 0 failures.
- `npm run build` — exits 0. (Ran with a dummy `DATABASE_URL` — local dev has
  none configured; the build itself doesn't touch a live database.)
- `node scripts/check-translations.mjs` — all gated languages (French, and
  the six-language marketing/document catalogues) complete. New `app.job.*`
  / `app.jobEdit.*` keys were added in **all six** app-catalogue languages
  (en/fr/es/uk/pa/tl) to match the existing convention for this namespace —
  every other recently-added `app.job.*` key already has all six, even
  though the catalogue's own header describes English+French as the
  contractual minimum. Spanish/Ukrainian/Punjabi/Tagalog were written by an
  agent, not reviewed by a speaker of those languages; French was written
  with more care and is the one that's actually gated.

### What could not be verified

- No live database in this environment (`DATABASE_URL` unset locally, and
  `prisma db push` was deliberately not run), so the actual PATCH route, the
  edit-page save flow, and the portal page were verified by reading the code
  and by executing the pure logic they call — not by clicking through the
  running app against real data.
- The four non-gated translations (es/uk/pa/tl) are mechanically consistent
  with their siblings but unreviewed by a speaker.
