# Payment schedule / deposits — where it actually is, and what it isn't

The owner's question, verbatim:

> "where does the company set the payment schedule? maybe they can request a
> deposit first, and then have the other balances if multiple payment
> schedules are set. When quote is approved and invoice is sent, and then it
> might be rule-based: start of job, or X days before start of the job, maybe
> they can say half way through the job, and maybe some remainder on the day
> the job is completed for example. I think we have that logic created, I'm
> not sure where."

Short answer: the company sets it in Settings → Company → **Payment terms**
(`app/app/settings/company/page.js`), and what happens to that text is
entirely cosmetic. There is no rule-based trigger engine anywhere in the
codebase. What follows is every real piece found while searching, and a
design for the part that doesn't exist, so nobody re-searches this later.

---

## 1. What exists today

### 1a. The thing the owner is remembering — and why it feels like more than it is

**`Company.paymentTerms`** — `prisma/schema.prisma:906` — a free-text field.
Set in **Settings → Company**, `app/app/settings/company/page.js:783-796`,
placeholder text literally: *"e.g. 50% deposit, balance on completion — or Net
30."*

**`lib/documents/paymentSchedule.js` → `parsePaymentSchedule(text)`** — a regex
parser. If that sentence contains 2+ percentages that sum to 95–105%, it
returns `[{ pct: "50%", label: "Deposit" }, { pct: "50%", label: "On
completion" }]`. Anything it isn't confident about (`Net 30`, `Due on
receipt`, one lone percentage) it declines and returns `null` — deliberately
conservative, per the file's own comment.

**`lib/documentSections/PaymentTermsSection.js`** — renders that parsed result
as three-across percentage cards on the quote/invoice PDF and email
(`PdfSection`, `renderEmailHtml`), or prints the raw sentence verbatim when it
couldn't parse a schedule, or renders nothing at all when the field is blank.
Shared by quotes and invoices, so both documents agree.

**This is the entire "payment schedule" feature that exists.** It is real,
wired, and does what it claims — a company that types "50% deposit, 50% on
completion" gets a nicely formatted schedule on every document. That's
probably what's triggering the owner's "I think we built that." But it is
purely a **display transform of a sentence a human typed**. Nothing reads the
parsed percentages to decide how much to charge, when, or from whom. Editing
the sentence to "10% discount for cash" would (correctly) print as a plain
sentence — the parser guards against exactly that kind of false positive, on
purpose — which shows how narrow its job is: format a sentence, nothing more.

### 1b. Partial payments on ONE invoice — real, and solid

**`Invoice.amountPaid` / `amountDue`** (`prisma/schema.prisma` ~2229-2232) plus
**`Payment[]`** (`prisma/schema.prisma:2343-2360`, many rows per invoice,
`amount`/`method`/`date` each). Two write paths keep them correct:

- `lib/invoices/recordStripePayment.js` — recomputes `amountPaid`/`amountDue`
  from **every** `Payment` row on each call, never assumes one charge closes
  the invoice ("a client can pay a deposit through Stripe; the balance is the
  source of truth" — line 63). Flips `status` to `paid` only once the balance
  hits zero.
- `app/api/payments/route.js` — the manual cash/cheque/e-transfer entry path,
  same recompute-from-all-rows discipline.

So **a homeowner genuinely can pay a deposit and then the remaining balance,
against the same invoice, and the invoice shows the correct running balance
throughout.** What's missing is everything upstream of that: nothing decides
*how much* the deposit should be, *when* to ask for it, or *that* there even
are two amounts due on two dates — a human has to manually collect each
payment (click "take payment," or log a payment received offline) with no
schedule telling them when.

**`createInvoiceCheckoutSession({ ..., amountCents })`** — `lib/stripe.js:74`
— accepts an explicit amount smaller than the full balance, "a deposit
request, say" (its own comment). This is the one piece of plumbing that looks
purpose-built for staged collection. But **grep shows its only two callers
never pass `amountCents`** — `app/api/portal/[token]/pay/route.js` and
`app/api/invoices/[id]/checkout-link/route.js` both always charge the full
remaining balance. The hook exists; nothing calls it with a partial figure.
There's also no cap in `lib/stripe.js` stopping a future caller from passing
an `amountCents` **larger** than `invoiceBalanceCents(invoice)` — fine today
because nobody exercises it, but a gap that would need closing before any UI
drives this parameter with a variable amount.

### 1c. `Job.invoices` — an aspirational comment, not a coded behaviour

`prisma/schema.prisma` ~2945-2948, on `Job.invoices Invoice[]`:

> "Plural: progress billing raises a deposit invoice and a final invoice for
> the same work."

This describes what the **shape allows** (a job can have many invoices), not
anything the code **does**. Confirmed by reading every invoice-creation path
(`lib/invoices/createInvoiceFromQuote.js`, `app/api/invoices/route.js`,
`app/api/quotes/[id]/convert/route.js`) — all of them create exactly one
invoice per call, on request, with no sequencing or rule logic. A staff member
*can* manually create a second invoice against the same job today (the schema
permits it), but nothing suggests doing so, nothing splits the amount, and
nothing automates it.

Related: `Invoice.parentInvoiceId` / `versions` (`prisma/schema.prisma:2171-
2175`) looks adjacent but isn't — that's invoice **revision history** (editing
an already-sent invoice creates a new versioned row with the same invoice
number), confirmed by `lib/invoices/invoiceNumber.js:21`: "A revised invoice is
NOT a new number." Different concept from a deposit/progress-billing chain;
don't conflate the two if building on this schema.

### 1d. Booking fee — a real deposit, for a different moment in the pipeline

`lib/booking/fee.js`, `lib/booking/settleBookingFee.js`,
`lib/booking/reconcileBookingFee.js`. A flat, contractor-set `EventType.feeCents`
charged via Stripe Checkout **to hold a booked visit slot** — before a quote
may even exist. Tracked on `Booking.feePaidCents` /
`feeStripePaymentIntentId` / `feeRefundedAt`, reconciled hourly by a cron
(`app/api/cron/booking-fees`) against Stripe as the source of truth. It works,
and it's genuinely a deposit in the plain-English sense.

It does **not** generalise to the owner's ask: there's no percentage-of-job-
value concept, no link to a `Quote` or `Job` total, and it fires once, at
booking time, for a fixed dollar figure the contractor set on the event type —
not a scheduled series against a job's price. Classify it as a different,
working feature that happens to share the word "deposit," not a building
block to extend.

### 1e. Service plans — the closest architecture, explicitly a different product

`ServicePlan` / `ServicePlanOccurrence` / `ServicePlanAuthorisation`
(`prisma/schema.prisma:6220` onward) plus `lib/servicePlans/*`. This is
recurring **maintenance-contract** billing sold to a client (not tied to one
job): a fixed cadence (weekly/monthly/quarterly/semiannual/annual) anchored to
`ServicePlan.startDate`, with `ServicePlanOccurrence` rows generated
idempotently (`@@unique([planId, seq])`), each with **frozen**
`subtotal/discount/tax/total` and a 1:1 link to a real `Invoice`. Two tiers:
tier 1 always raises an invoice + emails the existing pay link (works with no
stored card); tier 2, on top, optionally auto-charges a saved payment method
under a recorded Stripe mandate (`ServicePlanAuthorisation`, explicit consent
captured on `/plan/<token>` before Stripe is ever opened).

Confirmed with the owner's framing: this is recurring maintenance billing (a
seasonal contract), a different product from staged payments on one job — the
cadence is time-based and repeats indefinitely or for a fixed count, not a
one-time sequence of milestones tied to a single job's lifecycle. **The
machinery is genuinely reusable, though:**

- The occurrence-row-before-invoice idempotency pattern
  (`lib/servicePlans/run.js`, top-of-file comment: claim the sequence number
  first, so a doubled cron run can't double-bill) is exactly what a job
  payment-schedule engine needs.
- `lib/servicePlans/stripeMandate.js` + `lib/servicePlans/consent.js` (stored
  card, off-session charge, recorded consent) are directly reusable if the
  owner ever wants a stage to auto-charge rather than just email a pay link.
- `dueOccurrences()` in `lib/servicePlans/schedule.js` is the shape a
  trigger-evaluation cron for job stages would mirror.

None of this is wired to `Quote`, `Job`, or a percentage-of-total concept
anywhere — it's a parallel, self-contained system.

### 1f. A dead control found in passing (not fixed, flagged)

`app/data/emailTemplateBlocks.js:118` lists `{{depositAmount}}` as an
insertable merge-field chip in the email template editor (Settings → Email
Templates), and two preview/test fixtures give it a fake sample value —
`app/app/settings/email-templates/[id]/page.js:76` and
`app/api/settings/document-templates/[id]/test/route.js:39`, both
`"$1,275.00"`. But **no real send path ever sets `mergeData.depositAmount`** —
checked `app/api/invoices/[id]/send/route.js`, `app/api/cron/follow-ups/route.js`,
and `app/api/marketing/campaigns/[id]/send/route.js`, none of them populate it.
A company that drags this chip into a real invoice email will see it silently
render as an empty string forever, because there is no deposit concept in the
data model for it to read. Low severity — the merge renderer is deliberately
built to blank unknown tokens rather than error, so it fails quietly, not
visibly broken — but it's exactly the "a field offered and never wired" shape
AGENTS.md calls out. Left alone rather than fixed here: the honest fix is
either wiring it to a real deposit-schedule concept (once one exists — see
below) or removing the chip, and picking between those is a two-minute call
for whoever builds the real feature, not something to decide as a side effect
of this search. Flagged via `spawn_task` in case the owner wants it picked up
separately.

---

## 2. What's missing

Everything the owner actually described:

- **No schema** for a schedule attached to a quote or job — no stages, no
  percentages-with-triggers, nothing a homeowner sees before approving.
- **No trigger engine.** Nothing evaluates "has this quote just been
  approved," "did we just send this invoice," "is it N days before this job's
  first visit," "has this job just been marked complete," and reacts.
- **No "start of job" date at all.** `Job` (`prisma/schema.prisma` ~2887-2948)
  has no `startDate`/`endDate` — only `JobVisit.scheduledAt` per individual
  visit exists. "Start of job" isn't a stored fact; it would have to be
  *defined* (earliest non-cancelled visit's date, most likely) as part of
  building this.
- **No "percent complete" concept anywhere.** `JobVisit.status` is a string
  per visit; nothing rolls that up into a job-level completion percentage.
  The owner's "maybe halfway through the job" trigger has no data to fire
  from today — this is a product decision (self-reported by a foreman vs.
  inferred from visit counts), not a gap that can be closed with a formula.
- **No automatic second/third invoice, and no per-stage checkout link.**
  `amountCents` on `createInvoiceCheckoutSession` is unused, and uncapped
  against the invoice balance.
- **No homeowner-facing schedule anywhere** beyond the cosmetic percentage
  cards derived from one free-text sentence — the quote page, invoice page and
  client portal show a total and (once paid on account) a balance, never "you
  will be asked for $X now, $Y at job start, $Z on completion."

## 3. The gap, honestly

Split the feature in two:

- **Display** ("show a schedule on the document"): **100% built**, wired, and
  correct within its narrow scope (§1a).
- **Billing** (the actual ask — stages, rule-based triggers, automatic or
  semi-automatic staged collection): **0% built.** No schema, no trigger
  evaluator, no cron, no per-stage invoice, no client-facing schedule.

Weighted toward what the owner is actually asking for, this is roughly **10%
built** — a cosmetic feature that superficially resembles the idea, sitting
next to three unrelated systems (partial payments on one invoice, booking-fee
deposits, the service-plan recurring-billing engine) that are each solid and
individually reusable, but nothing wires them together into "stages on one
job with product-chosen triggers." This is a genuine design gap, not a
wiring-up job — nothing here was found "built and merely unreachable" at the
level the owner is picturing, so per the brief for this search, **nothing was
built in this session.** What follows is a design for the owner to choose
from, not a finished feature.

---

## 4. Design, for the owner to choose from

### Proposed schema (not applied — no `prisma db push` was run)

```prisma
model PaymentScheduleStage {
  id        String  @id @default(cuid())
  companyId String
  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  quoteId   String
  quote     Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  seq   Int     // display and firing order, 0-based
  label String  // company's own words: "Deposit", "Start of job", "Final payment"
  pct   Decimal @db.Decimal(6, 3) // % of the quote's accepted total; a quote's stages must sum to 100

  trigger     String    // on_approval | on_invoice_sent | days_before_start | on_start | on_completion | manual
  triggerDays Int?      // only meaningful for days_before_start

  status    String    @default("pending") // pending | due | invoiced | paid
  dueAt     DateTime? // resolved once the trigger fires against a real date
  invoiceId String?   @unique
  invoice   Invoice?  @relation(fields: [invoiceId], references: [id], onDelete: SetNull)

  // Frozen once invoiced — same reasoning as ServicePlanOccurrence.subtotal/
  // total: a stage's amount must never be re-derived from a percentage after
  // the client has already been billed for it.
  amountCents Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([quoteId, seq])
}
```

### Triggers, and what each would actually fire against

| Trigger | Data source | Status |
|---|---|---|
| `on_approval` | `Quote.status` → `accepted` | Real event, already hooked (`ensureInvoiceForQuote`) |
| `on_invoice_sent` | `Invoice.sentAt` gets set | Real, honest timestamp already exists |
| `days_before_start` | needs a job "start" date | **Not stored** — define as `MIN(JobVisit.scheduledAt)` across non-cancelled visits, evaluated at cron time rather than cached, so it can't drift from the visit list the way a cached copy could |
| `on_start` | same as above, fires same-day | Same caveat |
| `on_completion` | `Job.completedAt` | Real, already exists, deliberately set once |
| "halfway through the job" | **nothing** | No completion-percentage concept exists anywhere in the schema. Needs a product decision (self-reported vs. visit-count-derived) before any code — don't build this trigger blind |
| `manual` ("collect this stage now") | staff clicks a button | Needs no new data — reuses the already-built-but-unused `amountCents` param, smallest possible increment |

### What to reuse

- **`lib/servicePlans/run.js`'s ordering**: create/claim the stage row before
  creating its `Invoice` (`@@unique([quoteId, seq])`, mirroring
  `@@unique([planId, seq])`) — so a doubled cron run can't double-bill, same
  guarantee the service-plan engine already relies on.
- **`Invoice.amountPaid`/`amountDue`/`Payment[]` as-is** — a stage's invoice is
  an ordinary `Invoice` row; no schema change needed there, and partial
  payment against it already works correctly (§1b).
- **`createInvoiceCheckoutSession`'s `amountCents`** — finally exercised —
  with a server-side cap added: `min(requested, invoiceBalanceCents(invoice))`,
  since nothing enforces that today.
- **A cron** alongside the existing `app/api/cron/service-plans`, evaluating
  `days_before_start`/`on_start`/`on_completion` daily, mirroring
  `dueOccurrences()` in `lib/servicePlans/schedule.js`.
- **`lib/servicePlans/stripeMandate.js` + `consent.js`** — only if/when the
  owner wants a stage to auto-charge a saved card instead of emailing a pay
  link each time (tier 2). Not needed for a first version.

Non-negotiable #5 (browser never sends money amounts) holds automatically
under this design: the browser would only ever post a `quoteId` (and, for
`manual`, which `seq` to fire) — the server always computes the stage's dollar
amount itself from `pct × Quote.acceptedTotal`, exactly like every other
pricing surface in this codebase.

### Smallest honest first version

1. Schema above, **minus** the percent-complete trigger (no data source; the
   owner said "maybe" for it, and it's the weakest and riskiest of the list).
2. Quote builder UI: let a company add stages (pct + label + trigger) instead
   of typing a sentence — `parsePaymentSchedule`'s card rendering already
   exists and could display structured stages instead of parsed text, on both
   the quote and the invoice, once real data drives it instead of a regex.
3. On quote approval, if stages exist: create all stage rows frozen against
   the accepted total; raise the `on_approval` stage's invoice immediately (a
   deposit really does get requested the moment the client approves); other
   stages stay `pending` with `dueAt` computed where derivable.
4. A cron resolves `days_before_start`/`on_start`/`on_completion`/
   `on_invoice_sent`, raising each stage's invoice and emailing the pay link
   when its trigger fires — same tier-1 "invoice + pay link, no stored card
   required" default the service-plan engine already proved works standalone.
5. **No auto-charge in v1.** Every stage is invoice-plus-email, matching
   tier-1 service plans. Auto-charge (tier 2) is a deliberate v2, since it
   requires the client's advance consent to being charged automatically —
   Stripe's own compliance requirement, already solved once in
   `lib/servicePlans/consent.js`, reusable rather than re-invented.
6. Percent-complete: park it. Ask the owner whether "halfway through the job"
   should be self-reported by a foreman/PM or inferred from visit counts,
   before writing anything against it.

---

## 5. Related follow-up flagged, not fixed

`docs/PAYMENT-SCHEDULE.md` §1f above — the `{{depositAmount}}` merge-field
chip offered in Settings → Email Templates that never actually resolves to a
value in any real send path. Spun off as a separate background suggestion
(see chip) since fixing it well depends on whether the owner wants the real
deposit-schedule feature built, or wants the dead chip simply removed in the
meantime.
