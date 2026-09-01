# Payment schedule — the billing half, built

`docs/PAYMENT-SCHEDULE.md` is the research pass (2026-08-30-ish): what
existed before this session was 100% display (`Company.paymentTerms` free
text, parsed into cards on the PDF/email) and 0% billing. This session built
the billing half. Read that document first for the architectural survey —
this one is the build log: the math, every edge case and the decision made
for it, what changed for existing companies, and what was deliberately left
out.

---

## 1. The owner's rules, and how they turned into code

> "With the payment schedule of the company it would be based on the start
> and end date of the job, as well as invoice creation for deposit. So if
> it's like 30% deposit, that would be when the invoice is created and sent.
> If they also add balance is due when job is completed then it needs to
> look at job end date for the 70%. But if it says 30% deposit / 40% job
> start / 15% half way / 15% job end — half way would be the job end minus
> job start to calculate how many days the job takes, divide it by 2 and add
> that to the job start."

Four triggers, exactly this set, in `lib/paymentSchedule/engine.js`'s
`PAYMENT_SCHEDULE_TRIGGERS`:

| Trigger | What it reads | When it fires |
|---|---|---|
| `on_invoice_created` | nothing date-based | the moment the schedule is created — quote acceptance |
| `job_start` | `Job.startDate` | that date |
| `halfway` | `Job.startDate` + `Job.endDate` | computed — see §2 |
| `job_end` | `Job.endDate` | that date |

A fifth trigger, "N days before start," was in the original research as
something the owner had mentioned once. **Not built.** The owner's verbatim
rules for this session name exactly the four above, and "days before start"
needs a backfill policy — what happens when the window has already passed by
the time a job finally gets a start date — that was never specified. Adding
one with an invented answer to an unasked question is exactly the class of
unrequested behaviour AGENTS.md calls out. `PaymentScheduleStage.trigger`'s
schema comment records this as a deliberate omission, not an oversight, so
nobody re-litigates it by accident.

---

## 2. The halfway math, worked

```
durationDays    = daysBetween(start, end) + 1     // INCLUSIVE — the owner's own count
halfwayDayIndex = ceil(durationDays / 2)            // rounds UP on an odd duration
halfwayDate     = start + (halfwayDayIndex - 1) days
```

**The owner's own example, executed:**

```js
halfwayDate(2026-09-01, 2026-09-06)
// durationDays = 6, halfwayDayIndex = 3, halfwayDate = Sept 1 + 2 = Sept 3
=> 2026-09-03T00:00:00.000Z   ✓ matches "the half way point would be September 3" exactly
```

### The odd-duration decision — round UP, not down

A 5-day job gives `durationDays / 2 = 2.5`, which has to round somewhere.
This build rounds **up** (`Math.ceil`, day 3), not down (day 2).

- **Round down (day 2, i.e. Sept 2 for a Sept 1–5 job):** the halfway payment
  is asked for once 40% of the work is done, not half. It arrives *before*
  the midpoint — the version of this feature most likely to produce "you
  billed me for half the job when the crew had been there one day."
- **Round up (day 3, Sept 3):** the payment is asked for once *more* than
  half the work is done. Costs the contractor nothing (the money still
  lands before the job ends either way) and removes the one complaint a
  homeowner could have with the timing.

Every document a client sees is required by this codebase to look
trustworthy by default (the white-label mandate in AGENTS.md). Defaulting
the ambiguous case toward the interpretation that can never be read as
jumping the gun serves that directly, and it's consistent — every odd
duration rounds the same way. A contractor who disagrees can restructure
their own percentages; this default only had to pick one side and hold it.

**Executed:**

```js
halfwayDate(2026-09-01, 2026-09-05)   // 5-day job
=> 2026-09-03T00:00:00.000Z   // day 3, not day 2
```

### Every other duration case, executed

```js
// 1-day job — every date-based trigger collapses onto the same day
halfwayDate(2026-04-10, 2026-04-10)
=> 2026-04-10T00:00:00.000Z
resolveStageDueDate("job_start", { startDate: 2026-04-10, endDate: 2026-04-10 }).dueDate
=> 2026-04-10   // same for job_end and halfway too — all three coincide, on purpose

// A job spanning the 2026 US DST change (March 8 spring-forward)
jobDurationDays(2026-03-05, 2026-03-12)
=> 8   // a plain day count, unaffected by the clock change
halfwayDate(2026-03-05, 2026-03-12)
=> 2026-03-08T00:00:00.000Z   // day 4 — lands exactly ON the transition day, and is still correct

// End before start — an invalid range, not a negative duration
jobDurationDays(2026-09-10, 2026-09-01)
=> null   // refuses rather than returning -8
```

All of this is UTC-midnight arithmetic (`Date.UTC` components, no local-time
setters), the same convention `lib/servicePlans/schedule.js` documents and
relies on — UTC has no DST, so a day count computed in it can't drift a day
depending on where the server happens to be running or what the clock is
doing that week. The DST-spanning case above is the proof: the halfway date
lands exactly where plain calendar counting says it should, with no special
casing needed.

---

## 3. Every other edge case, and the decision made for it

### No end date at all

`Job.endDate` is nullable; a contractor may never set one. `halfway` and
`job_end` both need it and neither invents a stand-in:

```js
resolveStageDueDate("job_end", { startDate: 2026-09-01, endDate: null })
=> { dueDate: null, blockedReason: "awaiting_end_date" }
resolveStageDueDate("halfway", { startDate: 2026-09-01, endDate: null })
=> { dueDate: null, blockedReason: "awaiting_end_date" }
resolveStageDueDate("job_start", { startDate: 2026-09-01, endDate: null })
=> { dueDate: "2026-09-01", blockedReason: null }   // unaffected — never needed an end date
```

`blockedReason` is a real, named, visible state — never "now", never
"never", never the start date standing in for a date it doesn't have. The
job page (`PaymentScheduleCard.js`) renders it as "Can't schedule yet — set
an end date for this job" rather than a stage that quietly never fires.

**No dates at all:**

```js
resolveStageDueDate("job_start", {})  => blockedReason: "awaiting_start_date"
resolveStageDueDate("halfway", {})    => blockedReason: "awaiting_start_date"  // start checked first
```

### Dates moving after the schedule is set

**Yes, pending stages move with them.** `JobPaymentStage.status = "pending"`
rows have their `dueDate`/`blockedReason` **recomputed every cron run**
(`lib/paymentSchedule/run.js`'s `recomputeAndFirePendingStages`) from the
job's *current* `startDate`/`endDate` — never from a cached figure. A job
that slips a week drags every pending stage's due date a week with it,
automatically, with no separate "job dates changed" hook to keep in sync.

**Already-requested stages do not move.** The moment a stage fires (a
payment request is actually emailed), its `dueDate` freezes — a stage that
has already asked a client for money by a stated date must not silently
show a different one because the job got rescheduled afterwards. This
mirrors `ServicePlanOccurrence`'s own frozen-amount convention.

### Percentages not summing to 100

Never silently accepted, and never auto-corrected:

```js
validateSchedulePercentages([{ percentage: 50 }, { percentage: 49 }])
=> { valid: false, sum: 99 }
validateSchedulePercentages([{ percentage: 51 }, { percentage: 50 }])
=> { valid: false, sum: 101 }
```

`lib/paymentSchedule/validate.js` is the gate at save time — an invalid
template is **never written** to `PaymentScheduleStage`, so
`lib/quotes/quoteLifecycle.js` never has to reason about a company whose
saved schedule doesn't add up (it re-checks anyway, defensively, in
`companyScheduleTemplate` — belt and braces, same reasoning
`lib/currentMember.js` re-checks impersonation after middleware already
did). `computeSchedule` still resolves every stage on an invalid set — so
the Settings screen can show a contractor *why* it's invalid, not just a
bare error — but `valid: false` is the signal every caller must refuse to
act on.

### A zero-percent stage

Allocates exactly $0 and is marked `waived` the moment it would fire —
never a real invoice request for nothing:

```js
allocateAmountCents([{ seq: 0, percentage: 0 }, { seq: 1, percentage: 100 }], 100000)
=> [{ seq: 0, amountCents: 0 }, { seq: 1, amountCents: 100000 }]
```

### A £0 quote

Every stage allocates $0, whatever its percentage — 0% of anything is 0,
and 100% of $0 is still $0:

```js
computeSchedule({
  stages: [{ seq:0, trigger:"on_invoice_created", percentage:30 }, { seq:1, trigger:"job_end", percentage:70 }],
  job: { startDate: 2026-09-01, endDate: 2026-09-10 },
  totalCents: 0,
})
=> stages: [
     { seq:0, amountCents: 0, dueDate: null,          blockedReason: null },  // fires immediately, waived (see §4)
     { seq:1, amountCents: 0, dueDate: "2026-09-10",  blockedReason: null },
   ]
```

### Cent-exact allocation — the remainder always lands on the last stage

`allocateAmountCents` rounds every stage except the last independently, and
gives the **last stage (by seq) whatever is left over** — `total minus the
sum already allocated` — rather than its own independently-rounded share.
That's a deliberate difference from `lib/servicePlans/pricing.js`, which
accepts up to N−1 cents of drift across a service plan's occurrences because
nothing requires those to sum to a fixed figure. A payment schedule is the
opposite case: its whole premise is "these percentages add up to the total
you approved," so the arithmetic has to be exact, and it can be:

```js
// $1,234.56 quote, the owner's own 30/40/15/15 split
computeSchedule({ stages: [30,40,15,15]-shaped..., job: {start: 2026-09-01, end: 2026-09-06}, totalCents: 123456 })
=> amountCents: [37037, 49382, 18518, 18519]
   37037 + 49382 + 18518 + 18519 = 123456   ✓ exact, to the cent

// A pathological case: 33.333 / 33.333 / 33.334 against $100.00
allocateAmountCents([{percentage:33.333},{percentage:33.333},{percentage:33.334}], 10000)
=> sum === 10000   ✓ exact, despite none of the three rounding evenly on its own
```

---

## 4. What happens when a stage comes due

**Decision: one invoice, requested in stages — not one invoice per stage.**

This was actually already the codebase's stated intent before this session:
`lib/invoices/invoiceNumber.js`'s own header says *"there is no split-
invoice/deposit model to number; stage payments are a payment schedule on
one invoice, not several invoices."* The build honours that rather than
inventing a second design. `lib/quotes/quoteLifecycle.js`'s
`ensureInvoiceForQuote` call is **completely unchanged** — every job still
gets exactly the one invoice it always did, for the full accepted total.
What a structured schedule adds is *how that one invoice gets asked for*:

1. **The deposit (`on_invoice_created`) fires synchronously at quote
   acceptance** — not by a date, by the act of the schedule being created.
   This is what actually **sends** the invoice: before this feature, a quote
   acceptance created a *draft* invoice and nothing emailed it (confirmed by
   reading `app/api/public/quotes/[token]/route.js`, whose own activity-log
   comment says the invoice is "drafted", not sent). The owner's own words
   for the deposit — *"that would be when the invoice is created and
   sent"* — are the reason `requestStagePayment` stamps `Invoice.sentAt` the
   first time any stage fires.
2. **Every later stage (`job_start`, `halfway`, `job_end`) requests its own
   share** via a Stripe Checkout session **capped to that stage's
   `amountCents`** — never the invoice's full remaining balance. The client
   gets an email (`buildInvoiceEmail`'s new `requestAmount` override) with a
   portal link carrying `?stage=<id>`; the portal page shows that stage's
   own amount and label; the pay endpoint re-derives and caps the charge
   **server-side**, from the `JobPaymentStage` row, scoped by `companyId`
   (non-negotiable #5 — the browser only ever sends *which* stage, never an
   amount).
3. **`Invoice.amountPaid`/`amountDue`/`Payment[]` need no new tracking.**
   Whatever combination of stage payments has landed, the invoice's own
   running balance (`lib/invoices/computeInvoiceState.js`, unchanged) is
   already the correct answer — that machinery was already solid (see
   `docs/PAYMENT-SCHEDULE.md` §1b) and this build exercises it rather than
   duplicating it.

**Plumbing that was flagged unused and is now exercised:**
`createInvoiceCheckoutSession`'s `amountCents` parameter — built for exactly
this, called by nobody until now. It had no cap against the invoice's real
balance; added one (`lib/stripe.js`) before anything drove it with a
variable, server-computed figure, per the research doc's own flag.

**Stage status is deliberately not a duplicate "paid" flag.** A
`JobPaymentStage` is `pending → requested → (waived instead, for a $0
stage)`. Whether the client has actually *paid* lives on the Invoice/Payment
rows it already had — a second paid/unpaid flag on the stage would be
exactly the "two places that can disagree" failure class AGENTS.md warns
about, one step further along than usual.

---

## 5. Where the contractor sets it, and what happens to existing free text

**Decision: the structured schedule generates the free-text field, rather
than the two existing side by side as independently-typed descriptions of
the same thing.**

`Company.paymentTerms` still exists, still does exactly what it always did —
`lib/documents/paymentSchedule.js`'s parser, `PaymentTermsSection.js`'s
cards on the PDF/email — completely untouched. What changed:
`app/api/settings/payment-schedule/route.js`'s `PUT` handler **also
rewrites `paymentTerms`** to the exact sentence the new schedule implies
(`scheduleToText`, e.g. `"30% Deposit, 40% Job start, 15% Halfway, 15% On
completion"`) every time a valid schedule is saved. Settings → Company locks
the free-text field the moment a structured schedule is active and points
at the new "Payment schedule" card instead — turning the schedule off
unlocks free-text editing again.

This resolves the "two truths about the same thing" the task called out: a
homeowner reading the PDF/email now always sees the same numbers that just
billed them, generated from one source, rather than a screen that produces
cards on a document while a different screen produces the real invoices.

**Every existing company is unaffected.** A company with zero
`PaymentScheduleStage` rows — every company, before this session — hits
`companyScheduleTemplate` returning `null`, and `ensurePaymentScheduleForJob`
returns immediately having created nothing. `ensureInvoiceForQuote` runs
exactly as it always has. Nothing about an existing quote acceptance, an
existing free-text `paymentTerms` sentence, or an existing invoice changes
unless a company deliberately visits Settings and builds a schedule.

---

## 6. What was NOT built, and why

- **"N days before start" trigger.** See §1 — no resolved backfill policy,
  and outside the owner's stated set for this session.
- **Percent-complete / "job is X% done" as a trigger.** Never asked for in
  this session's brief (the four triggers are explicit and closed); no data
  source for it exists anywhere in the schema regardless.
- **Auto-charging a saved card.** Every stage is "invoice + emailed pay
  link," the same tier-1 default `lib/servicePlans/run.js` already proved
  stands on its own. Auto-charge would need the client's advance consent —
  Stripe's own compliance requirement, already solved once for service plans
  (`lib/servicePlans/consent.js`, `stripeMandate.js`) and reusable, but a
  deliberate v2, not bundled into this build.
- **Rendering a structured schedule's cards independently of the free-text
  parser.** `PaymentTermsSection.js` (the PDF/email component) was left
  completely untouched — the generated-text approach in §5 gets it the same
  correct, in-sync display for free, with no changes to a `@react-pdf/
  renderer`-dependent file. If a future session wants richer per-stage
  document rendering (due dates on the PDF, say, not just percentages),
  that's a real follow-up, not something quietly missing today.
- **A structured schedule editable per-quote.** The schedule is
  company-wide, matching how `paymentTerms` already worked and matching the
  owner's own framing ("the payment schedule of the company"). A quote-level
  override was not asked for and was not built.
- **Retroactively applying a new/edited template to jobs already in
  flight.** `JobPaymentStage` rows are frozen at creation from the template
  that existed the moment the quote was accepted — editing the company
  template afterwards only affects quotes accepted from then on, the same
  split `ServicePlan`/`ServicePlanOccurrence` already established.
- **A read-only Settings view showing the structured stage list to a member
  without edit permission.** The free-text `paymentTerms` field still shows
  in the read-only company view (and, once a schedule is active, shows the
  generated sentence, which is accurate) — the read-only branch of the
  Settings page does not additionally render the stage-by-stage editor in
  disabled form. Small, deliberate scope cut given the session's size; the
  underlying data is not hidden, just not duplicated onto that specific
  screen.

---

## 7. Verification

- `npx prisma validate` — passes. **`prisma db push` was NOT run**, per
  instruction — additive, nullable, new-models-only schema change, no
  existing rows touched.
- `scripts/check-money-flow.mjs` (existing script, extended rather than a
  new one added to `check:all`'s chain) — Section 14 adds 34 fixture
  assertions against `lib/paymentSchedule/engine.js`, executed with hostile
  input: the owner's exact 6-day example (asserted to the day), a 1-day job,
  the 5-day odd-duration rounding decision, no end date, no dates at all, an
  end-before-start range, a job spanning the 2026 US DST change, 99%/101%
  schedules, a 0% stage, a £0 quote, and three different cent-exact
  allocation cases (including the owner's real 30/40/15/15 split against a
  non-round total). Section 16 mutates `engine.js` on disk with **7**
  targeted bugs — rounding direction, the backwards-range guard on two
  separate code paths, the `on_invoice_created` clock guard, remainder
  absorption, the percentage-sum epsilon, `scheduleToText`'s validity check
  — and re-runs the whole file as a subprocess to confirm each one is
  caught. **All 7 caught. 118/118 assertions pass overall.**
- `npm run check:all` — passes (0 exit). One unrelated pre-existing finding
  was investigated and fixed along the way: `scripts/check-tenant-scope.mjs`
  flagged the new stage lookup in `app/api/portal/[token]/pay/route.js` as
  not directly `companyId`-scoped (it was provably safe via a chain through
  `invoiceId`, but the checker requires direct scoping the same as every
  other by-id lookup) — fixed by adding `companyId: client.companyId`
  straight into the `where` clause.
- `npm run build` — passes.

### A caution for whoever runs this next

While investigating a flaky-looking failure, a `npm run check:all` from an
earlier attempt in this same session was found still running in the
background (a Bash-tool timeout had stopped *watching* it, not stopped the
process) — a second, fully concurrent `check:all` run raced it, both
mutating `lib/analytics/moneyFlow.js` / `computeInvoiceState.js` /
`lib/paymentSchedule/engine.js` on disk via `check-money-flow.mjs`'s
mutation pass at the same time. That produced one spurious, unrelated-
looking failure (a `migrationRequest` tenant-scope finding that isn't
reproducible standalone). Killed the stray process, re-ran clean, confirmed
0 exit. Worth knowing if a future run of this suite shows a failure that
can't be reproduced by running the same check on its own.
