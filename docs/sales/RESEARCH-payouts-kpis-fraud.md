# Research: sales commissions, weekly payouts, rep KPIs, leaderboard, CAC, cohorts

Research only. No product code changed. This maps what already exists in
FieldQuo's money-ledger and analytics architecture against the brief, so
whoever builds this doesn't re-derive patterns that are already fought for
and working. It does not design the schema, RBAC, or Stripe triggers.

---

## 1. The commission ledger — should it follow `VoiceCreditEntry`'s shape?

**Yes, for the append-only/sum-not-counter part. No, for the state machine —
that's the one thing a commission row needs that a credit entry does not.**

`VoiceCreditEntry` (`prisma/schema.prisma:6725-6764`, `lib/voice/credits.js`)
gets three things right that a commission ledger needs unchanged:

1. **The balance is a SUM, never a stored counter.**
   `lib/voice/credits.js:599-609` — `balanceFor()` is a Prisma `aggregate`
   over `{ _sum: { cents: true } }`. There is no `Company.voiceBalance`
   column anywhere to drift out of sync with the rows that produced it. A
   commission ledger should do the same: no `Rep.commissionsOwed` column,
   ever — only a query over rows.

2. **`ref` is a unique index, and idempotency is enforced by the database,
   not by a read-then-write.** `lib/voice/credits.js:649-654` and the
   `writeEntry()` helper at `707-729`: a `P2002` unique-constraint collision
   on `(companyId, ref)` is caught and treated as success — it returns the
   row that already won, rather than throwing or double-writing. This is
   the exact shape a commission ledger needs for "a retried webhook must not
   pay twice" (the rule `lib/referrals/index.js`'s header states in words —
   see §2 below for where that rule is actually enforced in shipped code).

3. **One writer function per direction.** `addCredit()` / `debitCredit()`
   (`lib/voice/credits.js:654`, `685`) are the only two ways a row gets
   written; `pool` (which wallet) is derived inside `writeEntry()`, never
   chosen by a caller. A commission ledger should have the same shape: one
   `createCommission()`, not five call sites each doing their own
   `db.commission.create()`.

What `VoiceCreditEntry` does **not** need, and a commission row does: a
**state**. A voice-credit row is done the instant it's written — a call
either happened or didn't, a top-up either cleared or didn't. A commission
is not done when it's created; it changes truth value over weeks as the
underlying subscription survives (or doesn't), gets disputed, or gets
reversed. `VoiceCreditEntry` has no status column and doesn't need one.

**Recommended shape** (description, not a schema — that's out of scope
here): a `Commission` row is created once, in a state, and only ever
**appended to** via new rows or a status column moved forward — never
edited in place for a state that already shipped in a payout. The state
progression the brief asks for:

```
PENDING → QUALIFIED → PAYABLE → SCHEDULED → PROCESSING → PAID
                                                    ↘ REVERSED
                                    ↘ DISPUTED (from QUALIFIED or later)
```

The closest existing precedent for "a pure state machine that is the one
place a transition is legal or not" is **not** the credit ledger — it's
`lib/migrations/state.js`. Read its full shape:

- `TRANSITIONS` (`lib/migrations/state.js:38-76`) is an explicit `from ->
  [to, ...]` adjacency map. Anything not listed is refused.
- `canTransition(from, to)` (`~line 78`) is the single function every
  route imports rather than re-deriving the rule — the same "the copy is
  the one that rots" argument AGENTS.md makes.
- `TERMINAL_STATUSES` is a `Set` — checked once, not re-derived from the
  transition graph on every call.
- Crucially: `canWrite()`/`assertWritable()` is **re-checked inside the
  same transaction as the write**, against a value read fresh, never
  trusted from a status the caller read a request earlier
  (`lib/migrations/writes.js:36-51`, `loadWritableMigration()`). That
  exact discipline is what stops a commission being paid twice by two
  concurrent payout-batch runs racing on the same row.

A commission state machine should be a pure module in this same shape —
`TRANSITIONS`, `canTransition()`, re-checked inside the transaction that
moves the row — not new logic reinvented per route.

**How a reversal is recorded so history is never edited:** follow the
pattern `Payment.refundedAmount`/`refundedAt`/`disputeStatus`
(`prisma/schema.prisma:2412-2430`) and `MigrationWrite`'s snapshot
(`prisma/schema.prisma:3244-3249`, "a migrated Client the owner corrects
afterwards must not rewrite this log's account of what FieldQuo actually
wrote"). Two options exist in this codebase already and the second is the
better fit:

- **Payment's approach**: one row, mutated forward-only (`refundedAmount`
  is Stripe's own cumulative total, re-written idempotently — same value
  twice is a no-op, not a second refund).
- **VoiceCreditEntry's approach**: a reversal is a **new row**, sign-flipped,
  never an edit to the original (`debitCredit`/`addCredit` never call
  `.update()` on an existing entry).

For a commission, the VoiceCreditEntry approach is right: `REVERSED` should
be a **new negative-amount row** referencing the original commission's id
(a `reversalOfId` or similar), not a status flip on the original row that
erases what it originally said. The original row stays exactly as it was
approved — a state column can still say `REVERSED` for filtering, but the
money movement is its own row, the same way `debitCredit` never edits a
`topup` row to "fix" a balance; it writes an offsetting entry. This is what
"history is never edited" means in code that already exists here, not a
new principle.

---

## 2. Weekly payout batching — period definition, mid-batch changes, the seam

**No money moves in this build.** The clearest existing seam for "the
ledger and the transfer mechanism stay separate" is `VoiceCreditEntry`
itself: `addCredit()`/`debitCredit()` write rows; nothing in
`lib/voice/credits.js` calls Stripe. The Stripe side (topping up an actual
card) lives in the webhook route that calls `addCredit()` with a
`stripeRef` — a completely separate file, connected only by the ledger
call. **The commission ledger should keep that exact seam**: a
`PayoutBatch` (or whatever it's named) is a row that groups `PAYABLE`
commissions into `SCHEDULED`, and closing/processing a batch marks
commissions `PROCESSING` → `PAID`. Nothing in that path talks to Stripe
Connect transfers. The transfer mechanism is a future consumer that reads
`PAID` (or `SCHEDULED`) rows and moves money — a separate module, the same
relationship `grantReferrerCredit()` has to `stripe.customers
.createBalanceTransaction()` (`lib/referrals/index.js:238-256`,
`applyCreditToBalance`): the ledger row (`ReferralCredit`) is written
first and is the source of truth; the Stripe call is a side effect keyed
off it, and `stripeBalanceTxnId` on the row records whether that side
effect happened, so a Stripe outage produces an "earned but not yet
applied" row, not a lost credit and not a double-attempt (see
`applyPendingReferralCredits`, `lib/referrals/index.js:388-408`, which
sweeps unapplied credits later). That "record intent, apply as a
separate, retriable, idempotent step, and sweep what didn't land" is the
whole shape of the seam this build needs, with the "apply" side left
unbuilt.

**Defining and closing a payout period:** nothing in this codebase batches
money by a rolling period today — `payrollCost.js` computes pay for an
arbitrary `[from, to]` window per API call (`lib/analytics/payrollCost.js`
docblock, "every row arrives already fetched and scoped... by the route"),
it does not persist a "pay period" row that gets closed. `periodPresets.js`
(`lib/analytics/periodPresets.js`) defines calendar boundaries
(`thisMonth`, `thisQuarter`, etc.) on **UTC calendar days**, explicitly
because "range membership on UTC calendar days... two screens reading the
same API [otherwise] disagree about the same month." A weekly payout
period should reuse that same UTC-boundary convention rather than
inventing a new one — add a `thisWeek`/ISO-week preset if the payout UI
needs a human-readable label, but the underlying cutoff arithmetic should
be UTC day boundaries, matching every other period-scoped query in the
codebase.

**A commission that becomes payable mid-batch:** it simply isn't in the
batch. A batch should be defined by "every commission in state `PAYABLE`
as of the moment the batch is closed" — closing the batch is the boundary,
computed and stamped once (the same reasoning `burnRate.js` gives for
pinning `now` once at the top of `calculateBurnRate()`,
`lib/analytics/burnRate.js:93-96`: "Two reads of `new Date()` a few
milliseconds apart can land either side of a month boundary"). A
commission that qualifies five minutes after the batch closes is `PAYABLE`
and simply waits for next week's batch — there is no reason to reopen a
closed batch to admit it.

**A commission reversed AFTER being included but BEFORE money moves:**
this is exactly the gap `MigrationRequest`'s state machine names
explicitly for its own domain — "a migration that WAS paid and is later
called off" (`lib/migrations/state.js:56-63`, `paid -> cancelled`). The
same shape applies here: `SCHEDULED -> REVERSED` and `PROCESSING ->
REVERSED` must be legal edges in the transition map, and the batch total
must be **recomputed from live rows at the moment the transfer step
actually runs**, never trusted from the total computed when the batch was
closed — the same "re-check inside the transaction, never trust a status
read a request ago" discipline `loadWritableMigration()` enforces
(`lib/migrations/writes.js:36-51`). Concretely: the transfer mechanism (not
built in this phase) should sum `PROCESSING` rows itself immediately before
calling Stripe, not use a cached batch total — a commission reversed in the
gap between batch-close and transfer-run must silently drop out of that
live sum rather than being paid and then separately clawed back.

---

## 3. What analytics can be reused vs. rebuilt

| Brief asks for | Existing module | Reusable as-is? |
|---|---|---|
| Date-range filters, period presets | `lib/analytics/periodPresets.js` — `presetRange()`, UTC-day boundaries | Yes, directly. Same six presets apply to a rep leaderboard's date picker. |
| Trend vs. previous period | `lib/analytics/trend.js` — `compare()`, `describeRateTrend()` | Yes, directly. Takes `(current, prior)`, refuses a trend when `prior == null` (no fabricated baseline), returns `null` `deltaPct` when prior is 0 rather than inventing "∞%" or "up 100%". This is exactly the guard a "reps' MoM commission growth" tile needs. |
| Conversion rates (trial→paid, lead→won) | `lib/analytics/kpis.js` (`RATE_FLOOR`/`COUNT_FLOOR`, `rateKpi()`), `lib/analytics/winLoss.js` (`SAMPLE_FLOOR = 10`), `lib/analytics/tenantHealth.js` (`MIN_SAMPLE = 5`, `formatRate()`) | The **floor discipline** is reusable wholesale (see §4) — the actual win-rate/lead-conversion math is company-scoped, not rep-scoped, so it needs a new rep-scoped variant of the same shape, not a copy of the numbers. |
| Companies compared to peers (→ reps compared to peers) | `lib/analytics/companyComparison.js` — median-of-cohort, `MIN_COHORT_COMPANIES = 4`, `IN_LINE_BAND = 0.15`, self-excluded from its own benchmark | The **pattern** transfers directly to a rep leaderboard: a rep's rate against the median of other reps, refusing the comparison below a cohort floor, and always excluding the rep from their own benchmark. The company-specific metrics (`winRate`, `paidRate`, etc. in `metricsForCompany()`) would need rep-scoped equivalents, but `MIN_COHORT_COMPANIES`, `IN_LINE_BAND`, and the "always exclude self" rule should be reused as constants/pattern, not re-derived. |
| CAC cost inputs | `lib/analytics/marketingRollup.js` (spend/CPL by channel), `lib/analytics/payrollCost.js` (labour cost), `lib/analytics/burnRate.js` (overhead) | Partially — see §5. Commission itself is new. |
| Cohort retention | Nothing computes a cohort retention curve today | New — see §6. |

**Genuinely new, not a rebuild-avoidance question:** the commission ledger
itself, rep-scoped win-rate/conversion math (the company-scoped versions in
`winLoss.js`/`tenantHealth.js` group by company, not by
`createdById`/rep — though `winLoss.js`'s `toOpportunities()` already
carries `estimatorId`/`estimatorName` per opportunity,
`lib/analytics/winLoss.js:~178-183`, which is the closest existing hook
for "which person gets credit for this outcome" and should be the
attribution field a rep leaderboard groups by, rather than inventing a
second one), the leaderboard ranking/ordering logic, and CAC's numerator
(commission cost, once it exists).

---

## 4. The floors problem, applied to a leaderboard

**Argue for a floor of at least 10 decided outcomes before printing a
rep's trial→paid rate as a percentage — the same `RATE_FLOOR` the KPI
dashboard already uses, not a smaller number invented for this feature.**

The precedent is explicit and load-bearing, not a guess:

- `lib/analytics/kpis.js:96-104` (`RATE_FLOOR = 10`): "below ten decided
  outcomes, one of them flipping moves the rate by more than ten points,
  which is a bigger swing than anyone would act on."
- `lib/analytics/winLoss.js:60-66` (`SAMPLE_FLOOR = 10`): the identical
  argument, independently stated for win/loss reporting.
- `lib/analytics/tenantHealth.js:33-36` (`MIN_SAMPLE = 5`) uses a *lower*
  floor, but for a different claim shape — `COUNT_FLOOR`/`MIN_SAMPLE = 5`
  governs a **median or count-based figure** ("your jobs run at X%
  margin" — directional), not a rate that gets ranked against other
  people's rates. `kpis.js:106-111` states this distinction explicitly:
  `RATE_FLOOR` is for percentages, `COUNT_FLOOR` is for sums/medians. A
  **ranked** rate is closer to `RATE_FLOOR`'s use case than
  `COUNT_FLOOR`'s — a leaderboard is specifically the situation where
  small-sample noise gets read as skill, which is exactly the failure
  `RATE_FLOOR`'s ten-point-swing argument targets.

Why 10 and not fewer, restated for the rep case specifically: at three
trials, one conversion flip is a 33-point swing in the printed rate — far
larger than any real skill gap between reps, and a leaderboard is
precisely the surface where a fluke gets treated as proof. `companyComparison.js`
adds a second floor on top that applies here too:
`MIN_COHORT_COMPANIES = 4` (`lib/analytics/companyComparison.js:37`) — the
rep-leaderboard equivalent is a floor on **how many reps exist** before
ranking them against each other means anything; comparing two reps is not
a leaderboard, it's an accusation.

**Recommended behaviour below the floor:** follow `formatRate()`
(`lib/analytics/tenantHealth.js:49-55`) exactly — below the floor, show
`"N of M"` (e.g. "2 of 3"), never a blank and never a percentage. A rep
with 3 decided trials shows "1 of 3", ranked-but-unranked (excluded from
the sort, or sorted to a separate "not enough data yet" section) — the
same principle `docs/KPI-EMPTY-STATES.md` states for the KPI dashboard:
"how many we need to get a result," not a blank tile.

---

## 5. CAC — what's computable today, what needs to be entered by hand

**Computable now, from existing tables:**

- **Marketing spend, per channel, self-reported.**
  `lib/analytics/marketingRollup.js` — `MarketingSpend.amount`, summed and
  divided by `LeadRequest` counts (`getLeadCountsBySource()`). Explicitly
  labelled "as entered" (`marketingRollup.js:60-64`) — not a computed
  attribution, a hand-typed number per row.
- **Payroll cost.** `lib/analytics/payrollCost.js` — approved hours ×
  effective wage rate, company-wide (not filterable to "sales" labour
  specifically unless a `Worker`/`Member` is tagged as sales staff, which
  nothing in the schema currently does — see below).
- **Overhead.** `lib/analytics/burnRate.js` — recurring Expenses,
  no-worker Salary rows, Debt, Asset depreciation. Company-wide, not
  broken out by department/function.
- **Commission**, once this build ships the ledger described in §1 — sum
  of `PAID` commission rows in the CAC window.

**Would have to be entered by hand, or doesn't exist yet:**

- **Which payroll/overhead dollars are "sales" cost specifically.**
  `payrollCost.js` sums *all* approved hours company-wide; there is no
  `Worker.department` or `Member.function` field to filter "sales team
  payroll" out of "install crew payroll." Isolating a sales-specific labour
  cost either needs a new tag on `Worker`/`Member`, or CAC has to use
  **total** payroll/overhead allocated by some ratio — which is a business
  decision, not a data gap this research can resolve.
- **Retention, for "CAC per retained company."** Nothing in
  `lib/analytics/` computes a retention curve at all (see §6) — "retained"
  has no existing definition to hang a CAC-per-retained-company figure on.
- **Whether a company that closes still counts toward CAC.** `moneyFlow.js`
  and `receivables.js` are revenue-side; nothing currently marks "this
  acquisition failed" in a way CAC math could subtract out.

**Say plainly:** *CAC per company acquired* is computable today (spend +
commission + a chosen allocation of payroll/overhead, divided by companies
acquired in the period). *CAC per **retained** company* is not — the
retention definition it depends on doesn't exist in this codebase (§6),
and building the ratio without it would be exactly the kind of "figure
that looks precise and means nothing" `kpis.js`'s own header warns against
(`lib/analytics/kpis.js:6-16`). Ship CAC per acquisition; label "per
retained company" not yet supported until a retention definition exists,
rather than quietly dividing by an undefined denominator.

---

## 6. Cohort analysis — what's missing, and is there a retention calc anywhere

**No retention calculation exists anywhere in `lib/analytics/`.** Grepped
the directory; nothing computes "of companies acquired in period X, how
many are still active N months later." `trend.js` compares two periods'
totals to each other (this month's total vs. last month's), which is a
different question — it says nothing about whether the *same* companies
persisted, only whether the aggregate moved. `periodPresets.js` gives
fixed calendar windows (`thisMonth`, `lastMonth`, ...), not a rolling
"months since acquisition" axis, which is what a cohort table needs on
its x-axis (month 0, month 1, month 2... since signup, not calendar
month).

**What a rep cohort would need that neither file gives:**

1. **An acquisition-date anchor per company**, and grouping companies by
   that date into monthly (or weekly) buckets — `Company.createdAt`
   exists, but nothing groups by it today.
2. **A survival/churn definition** — the closest existing signal is
   `Subscription.status` (`canceled`) and `Company.onboardingStatus ===
   "churned"` (referenced directly in `lib/referrals/index.js`'s
   `checkRedeemable()`, "a suspended or churned referrer shouldn't be
   recruiting"), so the raw fact of churn is recorded. What's missing is
   a function that, for a cohort of companies grouped by signup month,
   computes "% still not-churned at month N" — that's the retention curve,
   and it does not exist.
3. **Rep attribution on the company itself.** Even with a retention
   function, "rep cohort" needs to know which rep gets credit for which
   company — and as noted in §3, no such field exists on `Company` today
   (no `salesRepId`/`closedById`/equivalent). `winLoss.js`'s
   `estimatorId`/`estimatorName` on a **quote** (`lib/analytics/winLoss.js`
   `toOpportunities()`) is the closest analog but attributes a *quote*
   outcome to a *staff member of the contractor's own company* — it has
   nothing to do with which FieldQuo sales rep closed that contractor as a
   customer. These are two unrelated concepts that happen to share the
   word "closed": one is FieldQuo's own sales attribution (doesn't exist),
   the other is a contractor's own quote attribution (exists, but is a
   different entity in a different tenant's data entirely).

**Conclusion:** cohort analysis is new work end to end — the acquisition-
cohort grouping, the retention-over-time calculation, and the rep
attribution it would need to join against, none of which have an existing
implementation to build on. `periodPresets.js` and `trend.js` are useful
utilities inside that new work (UTC-boundary discipline, prior-period
comparison guards) but neither answers the cohort question itself.

---

## 7. Fraud signals — detectable today vs. needs new capture

| Signal | Stored today? | Evidence |
|---|---|---|
| Same payment method | **Partially, only for client-facing invoice payments.** | `Payment.stripePaymentIntentId` (`prisma/schema.prisma:2408`) ties a payment to a Stripe PaymentIntent, from which a payment-method fingerprint *could* be pulled via a live Stripe API call — but nothing is stored locally (no `last4`/`fingerprint` column). This model is for a **client paying a contractor's invoice**, not for a company paying FieldQuo — the signal the brief actually needs (two "different" companies paying FieldQuo's subscription with the same card) has **no stored data at all** on the `Subscription`/billing side; `Subscription` stores `stripeCustomerId` but never a payment-method identifier. |
| Same phone | **Yes, structurally, not compared.** | `Company.phone`, `Member.phone` (`prisma/schema.prisma:843`, `1509`) are stored per company/member but nothing currently cross-references phone numbers across companies looking for reuse. The data exists; the matching logic doesn't. |
| Same email | **Yes, structurally, not compared across companies.** | `Company.email` (`843`), `User.email` (`@unique`, `1446` — unique **per user**, which is expected since one person can only have one FieldQuo login, but says nothing about two *different* logins sharing an email domain or a lightly-varied address). No cross-company email-similarity check exists (the closest precedent is `lib/referrals/index.js`'s "You cannot refer yourself... checked on the code, not the email, because the email is trivially varied" — i.e., the codebase already distrusts email as a fraud signal on its own, for the identical reason it would be weak here). |
| Same domain | **Partially.** | `Company.website` and `Company.emailDomain` (both `String?`) are stored per company, uncompared across companies. `lib/site/subdomain.js`'s reserved-subdomain list is a different, unrelated concern (account takeover of `*.fieldquo.com`, not cross-company domain reuse). |
| Stripe identity signals (Radar risk score, verified business) | **Partially, for Connect payout accounts only, not for a paying customer.** | `Company.stripeAccountId`/`stripeChargesEnabled` (`prisma/schema.prisma:988-990`) record whether a contractor's **payout** account is Stripe-verified — this is `grantReferrerCredit()`'s own fraud gate today ("a real business with a real payout account, not a burner signup," `lib/referrals/index.js` — the `stripeChargesEnabled` check). This is a genuinely reusable signal for a commission gate too: a company whose Connect account isn't verified is exactly as suspicious for commission-fraud purposes as it is for referral-fraud purposes, and the check is one field read, already proven in production. What's **not** captured: Stripe Radar's own risk scoring on the **subscription** charge (the payment that would trigger the commission) — nothing stores or reads a Radar risk score anywhere in the codebase. |
| Device fingerprint | **Yes — but for login sessions, not signup, and scoped to a different problem.** | `lib/security/deviceGuard.js` + `AccountAbuseStrike` (`prisma/schema.prisma:1682-1701`) hash a device fingerprint and record distinct-device/concurrent-network patterns **per login**, to catch seat-sharing on an *existing* account — not to catch two *different* company signups originating from the same device. The infrastructure (a hashed fingerprint, a strike record, a human-reviews-it design) is a strong precedent to reuse the shape of, but it is wired to `lib/currentMember.js` (post-login), not to the signup flow, so it captures nothing at the moment a new company is created. |
| IP at signup | **No.** | `Session.ipAddress`/`userAgent` (`prisma/schema.prisma:1565-1566`) exist on Better Auth's session table and are populated per login session — but there is no evidence any signup-time event captures and *persists* the originating IP against the `Company` row itself (as opposed to whatever session happens to exist around that moment). Say plainly: **IP-at-signup is not captured as a durable, company-attributed fact today.** |
| Rapid creation (many companies from one source in a short window) | **No dedicated detector, but the raw timestamps exist.** | `Company.createdAt` exists; nothing currently queries "N companies created within M minutes sharing referrerId/repId." `lib/referrals/index.js`'s `MONTHLY_REFERRAL_CAP = 50` (a **count** cap per referrer per month) is the closest existing anti-velocity control, and it's a count cap specifically because "a dollar cap would silently strand earned credit" — the same reasoning would argue for a **count** cap on commissions per rep per period as a first-line control, reusing a pattern already shipped, rather than inventing a new velocity detector from scratch. |
| Cancellation right after a milestone | **Data exists (`Subscription.canceledAt`, `Subscription.status`); no rule reads it for fraud purposes.** | The commission state machine itself (§1) is the natural home for this — a `PAYABLE -> DISPUTED` or `PAYABLE -> REVERSED` transition triggered by a cancellation inside some window of the milestone, the same way `markPastDue`/`clearPastDue` already react to subscription status changes (`lib/platform/stripeBilling.js:463-540`). This is new logic, but it plugs into an existing, working webhook path (`syncSubscriptionFromStripeEvent`), not a new one. |
| Refunds | **Yes, for client-invoice payments (`Payment.refundedAmount`/`refundedAt`). No, for a company's own FieldQuo subscription payment.** | `lib/stripe/settleChargeEvent.js`'s own header states the boundary explicitly: "A charge/dispute that doesn't match any Invoice Payment (**a subscription invoice**, a voice/AI top-up, a booking fee — none of which create a Payment row) is simply not ours." A refund on the exact charge that would trigger a commission (the company's subscription payment to FieldQuo) is **not recorded anywhere** today — confirmed by reading `app/api/platform/billing/webhook/route.js` end to end: it handles `checkout.session.completed`, `invoice.payment_succeeded/failed`, `customer.subscription.*`, but there is no `charge.refunded`/`charge.dispute.*` handling on the **platform billing** path, only on the Connect/client-payment path. |
| Chargebacks | **Same gap as refunds — not recorded for a company's own subscription payment.** | Same evidence as above. This is arguably the single most important gap to flag: a chargeback on the exact transaction a commission would be paid on has no code path that reacts to it today, at all. |

**Bottom line:** several of the brief's fraud signals — device, IP at
signup, Stripe Radar risk, chargeback/refund on the commissioned
transaction itself — are **not captured today** and would need new capture
work before any detector could use them, not just a new query over
existing rows. The ones that partially exist (phone, email, domain,
payment method, Connect verification) exist as **stored facts with no
cross-company comparison logic** — the data is there, the matching isn't.

---

## 8. The review state — holding a flagged commission without accusing anyone

The direct precedent already shipped for exactly this posture is
`lib/security/deviceGuard.js`'s own design, stated in its header
(`lib/security/deviceGuard.js:24-33`):

> "`under_review` IS A FLAG FOR A HUMAN, NOT A LOCKOUT. Nothing in the app
> may deny access, hide data or block a write because of this value without
> a product decision... It exists so a FieldQuo admin gets told to go and
> look, and so the customer sees an honest banner instead of being cut off
> by a rule nobody explained."

And its threshold philosophy (`deviceGuard.js:19-22`): "Everything here is
deliberately biased toward missing abuse... Under-flagging is the intended
failure mode." One matching signal never sets the flag on its own — the
device guard requires *distinct-device count past a threshold set well
past 'unusual'*, or *concurrent networks*, not a single coincidence.

Applied to a flagged commission: a `PAYABLE -> UNDER_REVIEW` (or
equivalent) transition should require **more than one independent signal**
agreeing (e.g., same payment method **and** rapid creation, not either
alone), mirroring `AccountAbuseStrike.kind` recording *which* signal fired
and its `detail` (`prisma/schema.prisma:1690-1695`) so a human reviewer
sees *why*, not just a red flag. The commission itself should never be
auto-reversed by the detector — only held out of the next payout batch
(kept at `PAYABLE`, excluded from batch inclusion, or moved to a distinct
`UNDER_REVIEW` state that a human clears back to `PAYABLE` or forward to
`REVERSED`). That mirrors `accountStatus`'s own rule: "nothing reads
`accountStatus` to deny anything, and it must stay that way without a
product decision" — the equivalent commission rule is that nothing should
auto-transition a held commission to `REVERSED` without a human decision;
the detector's whole job is getting it in front of a person, the same way
`PlatformAuditLog`/`/platform/audit-log` and `PlatformErrorLog` exist as
"read daily, not configured" surfaces (`app/components/platform/
PlatformSidebar.js` groups Errors under "Support: things that need a
person's attention," not under an automated-action group).

---

## What I could not determine

- Whether `Worker`/`Member` has (or should get) a department/function tag
  to isolate sales-team payroll from install-crew payroll for CAC purposes
  — this is a schema decision, explicitly out of scope for this research.
- Whether Stripe Radar is enabled on the FieldQuo Stripe account at all
  (a dashboard setting, not something visible from the codebase) — if it
  isn't, "Stripe identity signals" for the *subscription* charge would
  need that turned on before any risk score could be read, separate from
  any code change.
- Whether `AccountAbuseStrike`'s device-fingerprint hashing
  (`lib/security/deviceGuard.js`) could be extended to run at signup with
  acceptable false-positive risk, or whether that's a materially different
  privacy/consent surface than gating an existing login — this needs a
  product/legal call, not a code read.
- No live database was queried — every claim above is from reading source
  and schema, not from checking whether, e.g., any `Company` rows already
  share a phone number in production today.
