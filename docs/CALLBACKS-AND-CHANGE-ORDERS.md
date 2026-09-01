# Callback/rework tracking, and change orders — what was built, and why

Two KPIs that `lib/analytics/kpis.js` refused to compute — `reworkCallbackRate`
and `changeOrderRate` — now compute honestly. This is the write-up the task
asked for: the owner's question about change orders, answered with evidence
before anything was built; the rework/warranty/not-our-fault distinction and
where it's recorded; the boundary tests, executed; and what was deliberately
left alone.

---

## Part one: is logging an edit "the easy way" for change orders?

The owner's question, verbatim: *"Is that just a way to log the edit as a
change order so that we keep track? Would that be the easier way?"*

**No — and here's the evidence, not just the assertion.**

### What a "quote edit" actually is today

`app/api/quotes/[id]/route.js`'s `PATCH` handler updates the `Quote` row **in
place**. No version, no history, no `changeLog`. Read the file: the update is
a single `db.quote.update({ where: { id }, data: {...} })` with nothing kept
of what the row said a moment before. A quote edited five times before it's
sent and a quote edited once look identical afterward — there's no original
scope preserved anywhere to compare a "change" against.

`lib/analytics/kpis.js`'s own `NOT_TRACKED` entry (before this change) said
exactly this: *"A quote is edited in place before it is sent; nothing
distinguishes an original scope from a change agreed mid-job."* That's not
a policy gap, it's a structural one — there's nothing to log an edit
*against*.

### What invoice "versioning" actually does

`Invoice.parentInvoiceId`/`version`/`changeLog` **do** exist, and at first
glance look like exactly what a change order needs. `PATCH
/api/invoices/[id]` (read in full before writing anything here) creates a new
version whenever a **non-draft** invoice is edited:

```js
// app/api/invoices/[id]/route.js — PATCH, non-draft branch
const newVersion = await db.invoice.create({
  data: {
    ...
    changeLog: {
      reason: changeReason || "Invoice updated",
      changedBy: member.userId,
      at: new Date(),
    },
    ...
  },
});
```

The trigger is **any field changing on a sent invoice** — `lineItems`,
`subtotal`, `discount`, `tax`, `total`, `dueDate`, `notes`, `clientPhotos`,
`costing`. `changeReason` defaults to the literal string `"Invoice updated"`
when nobody supplies one. So a due-date correction, a typo fix in the notes,
or re-attaching a photo all produce a new "version" indistinguishable, at the
schema level, from a genuine scope change that moved the price.

**If every invoice version were counted as a change order, the rate would
count things that were never agreed with the client at all** — an office
admin fixing a due date typo would show up next to a homeowner agreeing to
add a subpanel. That is precisely the AGENTS.md failure this repo keeps
getting swept for: *"a control that appears to work and doesn't"* — a rate
that looks precise and means nothing. Confirmed by reading, not assumed:
there is no field on `Invoice` that distinguishes "this version changed the
price because the client agreed to more work" from "this version fixed a
typo."

### So what's the honest boundary?

`Quote.sentAt` and `Quote.acceptedAt` exist and are meaningful (checked
`prisma/schema.prisma` directly): a quote edited **before** `sentAt`/before
`acceptedAt` is drafting — nobody outside the company has agreed to anything
yet, and every edit is normal, expected churn. A quote (or the resulting
job/invoice) changing **after** `acceptedAt` is a different kind of event —
the client already said yes to a number, and something is now different from
what they agreed to.

But even that boundary doesn't get you a change order for free: `acceptedAt`
being set doesn't tell you *what* changed or *what it did to the price* —
only *when* the door to "this needs its own record" opened. There is no way
to derive "add a subpanel, +$340" from a timestamp.

### The decision

Built the smallest honest thing: a new `ChangeOrder` model
(`prisma/schema.prisma`), created only when a person deliberately logs one —
never auto-generated from a `PATCH` to `Quote` or `Invoice`. Two fields that
matter: `description` (free text — what changed) and `priceDelta` (what it
did to the price, positive or negative). No `status`, no proposal workflow —
the owner's own framing was "a change agreed mid-job," i.e. already agreed by
the time someone logs it, so there's nothing to approve inside the record
itself.

**Deliberately not wired to `Quote.acceptedAt` as a hard gate.** A job with no
quote at all (a manual job, a warranty return with nothing quoted yet) can
still have a legitimate client-agreed scope change — gating creation on
`quote.acceptedAt !== null` would refuse a real change order on exactly the
kind of job most likely to need one. The permission gate instead mirrors
`PATCH /api/invoices/[id]`'s own edit gate: `jobs:view_create_edit` +
`showPricing` (a `priceDelta` is money). See
`app/api/jobs/[id]/change-orders/route.js`.

**No edit or delete endpoint.** A change order is a record of something
already agreed with the client. A mistake gets a correcting entry (a second
`ChangeOrder` with a negative `priceDelta` and a description saying so), not
a rewritten history — the same append-only reasoning `Quote.declineReason`
and the invoice `changeLog` itself already use elsewhere in this codebase.

### Is invoice versioning "closer to a change order than anything on Quote"?

Yes — structurally. It's the only place in the schema that already keeps a
`changeLog` and a price history. But structural proximity isn't the same as
correctness: it fires on the wrong trigger (any edit, not an agreed scope
change) and carries the wrong payload (a free-text `reason` string, not a
change description + price effect pair a report can sum). `ChangeOrder`
reuses the *shape* of that idea — description + what happened to the money —
without reusing the *trigger*.

---

## Part two: rework, warranty, and "not our fault"

The owner's framing, verbatim: *"Sometimes some clients call back because
there is something they think is missing, or something under warranty that
needs attention."* And separately, on the risk of over-counting: a client who
turns out to be wrong about something being missing is a scope
misunderstanding, not a defect — filing it as rework anyway makes the rate
meaningless.

### Where a warranty period lives today — it doesn't

Grepped the schema and every pricing file for "warranty" before writing any
of this (see `lib/jobs/callbackReasons.js`'s own header for the full list of
hits). Every warranty-shaped string in this codebase is one of two things:

1. **A contract-template placeholder** — `lib/documents/contractTerms.js`:
   `"Warranty: [state your own term and what it covers]"`. Free text for a
   human to fill in per company, never a stored date.
2. **A paid product** — `lib/pricing/tradeScope.js`'s `warrantyVisits` /
   `warrantyInspection`: a company can sell "N warranty inspection visits" as
   a line item on a quote. That's a count of visits sold, not a promise with
   a start and end date the system could compare "today" against.

There is no `Company.warrantyMonths`, no `Quote.warrantyExpiresAt`, nothing.
**Absence of a statement is not a statement** (AGENTS.md) — inventing a
default warranty length (say, 12 months) to auto-classify a return as
"within warranty" would be exactly the padding that rule exists to forbid. So
this is not computed. It's a judgement call, made by the person booking the
return, from a closed list: `rework` | `warranty` | `not_our_fault`
(`lib/jobs/callbackReasons.js`).

### Two shapes, on purpose

The task asked me to decide between "a flag on a new visit" and "a whole new
job linked to the original" — and to justify it. Built **both**, because the
two returns the owner described are genuinely different sizes of event:

- **`JobVisit.returnReason`** (+ `returnNotes`) — a same-week touch-up. The
  crew is going back to the same address for work already on this job; it
  shares the job's own materials list, costing and any invoice already
  raised. Set when the return visit is booked
  (`POST /api/jobs/[id]/visits`), editable afterward
  (`PATCH /api/jobs/[id]/visits/[visitId]`) because a mis-tap on a phone
  should not permanently taint a job's rework rate with no way back — `null`
  is a legal value to PATCH back to.

- **`Job.originalJobId` + `Job.callbackReason`** (self-relation) — a warranty
  return weeks or months later that needs its own scheduling, its own
  materials list, and possibly its own invoice. Modelling that as one more
  `JobVisit` on a job that finished and was archived months ago would be
  forcing a second piece of work into a record that's done. A new `Job`
  pointing back at the original (`app/app/jobs/new?originalJobId=...`, wired
  through `lib/jobs/createJob.js`) is the honest shape — and it's exactly how
  the codebase already treats "job carries its own visits, materials, and
  invoices" for ordinary work.

Both write the *same* three-value vocabulary, so `lib/analytics/kpis.js`
never has to know which shape produced a reason —
`mergeCallbackReasons()` folds them into one map before the rate is computed.

### Why "not our fault" is a real, counted category

If it weren't recordable, an estimator faced with a client who's simply wrong
about scope has two bad options: log it as rework anyway (poisoning the
rate), or don't record the visit at all (losing the fact that a return trip
happened, and the labour it cost). `not_our_fault` is recorded — it still
shows up in `raw.notOurFaultOnly` on the KPI envelope, so nobody loses the
information that a trip happened — but it does **not** count toward the
rate's numerator. Verified by an executed mutation (see below): a version of
`buildReworkCallbackRate` that folds `not_our_fault` into the numerator was
written, run, and caught by the "10 jobs, 3 with rework/warranty… rate is
exactly 30%" assertion — the rate would have read 40% instead.

### The denominator decision: callback jobs are excluded from their own rate

A job that is *itself* a callback (`Job.originalJobId` set) is excluded from
`buildReworkCallbackRate`'s denominator. Reasoning: the rate answers "of the
jobs we did, how often did we have to go back" — a warranty-return job isn't
a fresh piece of work being measured for whether *it* needed a return; folding
it into the denominator would dilute the rate with jobs that were never new
work to begin with. This filter happens in the route
(`app/api/analytics/kpis/route.js`, `reworkJobs = completedJobs.filter((job)
=> !job.originalJobId)`), not in the pure function — `kpis.js` just takes
whatever job list it's handed.

`buildChangeOrderRate` makes the opposite choice deliberately: its population
is **every** completed job, callback jobs included, because whether a job
is itself a return has nothing to do with whether its own scope changed
mid-way.

---

## The KPIs, wired in

Both follow `lib/analytics/kpis.js`'s existing envelope exactly —
`{ value, sampleSize, incomplete, reason, reasonText }` — and reuse the
existing `RATE_FLOOR` (10) and the existing `no_completed_jobs` /
`below_floor` reason codes rather than inventing new copy for the same two
facts ("nothing yet" and "not enough yet, here's how many more"). No new
`REASONS` entries were needed.

They live under a new `quality` key on `buildKpis()`'s return value, and a
new **Quality** section on `/app/analytics/kpis`, between Execution and Cash.
Both cards carry the same `KpiTile` component every other card on that page
uses — same "—" discipline, same `incomplete` triangle, same translated
`reasonText`.

---

## Boundary outputs, executed

From `node --import ./scripts/alias-loader.mjs scripts/check-kpis.mjs
--no-mutate`, real fixtures, real assertions (Section 4b):

```
reworkCallbackRate — 0, 1, floor-1, floor, floor+1 jobs, ALL with a rework callback
  0 jobs  → null (no_completed_jobs)
  1 job   → null (below_floor), sampleSize 1, 9 remaining
  9 jobs  → null (below_floor), sampleSize 9, 1 remaining
  10 jobs → 100%
  11 jobs → 100%

changeOrderRate — same shape, ALL with a change order
  0 jobs  → null (no_completed_jobs)
  1 job   → null (below_floor), sampleSize 1, 9 remaining
  9 jobs  → null (below_floor), sampleSize 9, 1 remaining
  10 jobs → 100%
  11 jobs → 100%

Known numbers (10 jobs each):
  reworkCallbackRate: 3 jobs with rework/warranty (one carrying BOTH — counts
    once), 1 not-our-fault-only → 30%. raw: reworkCount=2, warrantyCount=2,
    callbackJobs=3, notOurFaultOnly=1.
  changeOrderRate: 2 jobs with a change order (one carrying two orders) → 20%.
    raw: totalChangeOrders=3, totalPriceDelta=$600.

Hostile shapes named in the task:
  mergeCallbackReasons({ callbackJobs: [{ originalJobId: "job-from-last-
    quarter", callbackReason: "warranty" }] }) against a job list that does
    NOT contain "job-from-last-quarter" — the reason lands in the merge map
    (nothing throws) but never reaches the rate: 1 real callback of 10 jobs
    still reads exactly 10%, not 20%. The orphaned entry has nowhere to
    attach because the caller's own job list decides what gets scored.
  A change order on a job with NO quote at all (no `quote` key, not even
    null) still counts identically to one that came off an accepted quote —
    1 of 10 = 10%, $250 — because buildChangeOrderRate never reads
    job.quote at all.
```

## Mutations run (4 new, all caught)

1. **Counts a not-our-fault-only job toward the numerator** — the owner's own
   stated risk, executed. Caught by the known-numbers assertion (30% would
   have read 40%).
2. **Drops the second reason when a job carries both rework and warranty** —
   caught by `raw.warrantyCount === 2`.
3. **Counts a job with zero change orders as having one** — caught by the
   known-numbers assertion (20% would have read 100%).
4. **`mergeCallbackReasons` attaches a reason with no jobId instead of
   skipping it** — caught by a dedicated assertion (`size === 0` for a row
   with `jobId: null`).

All 19 mutations in the file (15 pre-existing + 4 new) are caught. 212
assertions without mutation (up from 172), 232 with (up from 158+14).

---

## What was not built, and why

- **A warranty period, computed.** No field exists to compute one from — see
  above. Building a default would be inventing data that isn't there.
- **Auto-logged change orders from a `PATCH` to `Quote` or `Invoice`.** The
  whole point of Part One: it would flood the rate with noise. If the product
  later wants a *suggestion* ("this invoice edit looks like a scope change —
  log it as a change order?"), that's a UI nudge on top of the existing
  manual flow, not an automatic write — a decision for the owner, not one to
  make silently here.
- **A `status` / approval workflow on `ChangeOrder`.** The owner's framing was
  "a change agreed mid-job" — already agreed by the time it's logged. Adding
  proposed/approved states is a real product decision (does the client
  e-sign a change order? does it need a second approver?) that nobody asked
  for yet.
- **Editing or deleting a `ChangeOrder`.** Append-only, matching every other
  agreement record in this codebase. A correction is a new entry.
- **Linking a `ChangeOrder` to the invoice it was eventually billed on.**
  Considered — an `invoiceId` column — and dropped: nothing in this change
  would have populated or read it, and a schema field nothing writes is the
  exact "wrote it, never showed it" failure AGENTS.md names. Worth building
  when there's an actual UI flow that bills a logged change order.
- **es/uk/pa/tl translations for the new strings.** Same call
  `docs/KPI-EMPTY-STATES.md` already made and documented: the App interface
  catalogue is gated on English and French only
  (`app/i18n/appMessages.js`'s own header explains why), and this whole
  `app.kpis.*`/`app.job.*`/`app.changeOrder.*` surface already renders in
  English for those four languages. Adding six-ish machine-translated
  strings to otherwise-English screens would be a worse, more inconsistent
  result than the uniform fallback. Verified: English and French both 100%
  via `node scripts/check-translations.mjs`, exit 0.
- **A `prisma db push`.** Per the task's own instruction — schema validated
  with `npx prisma validate` only; the database has not been migrated.
