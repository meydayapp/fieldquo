# FieldQuo — onboarding and compensation

For a new sales rep, and for whoever hires them.

Every number in this document was computed by executing the functions that
actually decide it, not by reading them. Where a figure appears, the function
that produced it is named beside it. If this document and the code ever
disagree, the code is right and this file is a bug.

**Sources of truth**

| Thing | File |
|---|---|
| Who earns what, and when | `lib/sales/commission.js` |
| When a week closes into a payout | `lib/sales/payouts.js` |
| The default amounts | `prisma/schema.prisma`, `model SalesCommissionPlan` |
| What a contractor pays | `lib/pricing/ladder.js`, `lib/pricing.js` |
| Milestone 1 firing | `app/api/stripe/webhook/route.js` |
| Milestone 2 firing | `lib/platform/stripeBilling.js` |
| Milestone 3 firing | `app/api/cron/sales-retention/route.js` |
| Batches closing | `app/api/cron/sales-payouts/route.js` |

---

## Part 1 — Hiring

### A sales rep is a third identity

Not a Member of a company, and not a PlatformAdmin. `SalesRep` is its own
model, and both other credentials refuse a rep's token and vice versa. A rep
signing in goes to `/sales`; `middleware.js` sends anyone without a rep session
to `/sales/login`.

This matters for one practical reason a new rep will hit on day one: **your
FieldQuo sales login is not a FieldQuo contractor account.** You cannot look
inside a customer's account with it, and there is no screen that will let you.

### Joining is invite-only, and there is no way around it

AGENTS.md non-negotiable #1: company signup is open, but *joining* is
invite-only, and platform admin is never self-serve. A rep is created by a
superadmin in the platform console. The rep receives an invite carrying a
hashed token (`SalesRep.inviteTokenHash`, `inviteExpiresAt`) and sets a
password against it.

### The four identifiers a new rep is given

These are four different things and new reps confuse them constantly.

| Field | What it is | Changeable later? |
|---|---|---|
| `email` | How you **sign in**. Where your invite went. | — |
| `workEmail` | The mailbox you **send outreach from**. Assigned by an admin. | Yes |
| `code` | The slug in **your signup link**. | **No — fixed at creation** |
| `demoCompanyId` | Your own resettable demo tenant, one per rep. | Admin-assigned |

**`workEmail` has deliberately no fallback to `email`.** The schema comment is
explicit about why: a mailbox is bought, so there is a real window where a rep
has a login and no address to send from. If FieldQuo quietly fell back to your
login address, cold outreach would go out from your personal Gmail and a
stranger's reply would land somewhere the portal cannot see. So a missing work
mailbox **blocks sending outright** rather than degrading to something that
looks like it worked.

**Your code is fixed after creation, on purpose.** By the time you have been
selling for a week the link is on a card, in an email signature and possibly
on a truck. Editing it would quietly stop some of your signups counting — a
destructive operation wearing a cosmetic label, which is the failure class
AGENTS.md names outright.

### Your signup link, and what it does and does not do

    /signup?sales=<your code>

**The link grants the contractor nothing extra.** No free month beyond the
normal trial, no credit, no banner. This was verified in
`app/api/companies/route.js`: `salesCode` is resolved *independently* of the
promo and referral waterfall, and nothing in that path grants a reward.

That is a real difference from the referral programme, which *does* give a free
month, and a rep who assumes otherwise will promise something the product will
not deliver. **Do not tell a contractor they get anything for using your link.**
They get the same first month free that everyone gets.

What the link does is create the attribution row that pays you.

### Attribution: you cannot claim a company, the company claims you

There is no rep-facing write path to `SalesAttribution`. Attribution happens
when the **company** acts — they sign up through your link. A rep cannot pay
themselves by asserting a relationship that did not happen. Manual attribution
is superadmin-only.

Attribution locks at capture (`lockedAt`). One row per company, ever. A
correction writes a new row plus a `SalesAttributionAudit` entry in the same
transaction — it never overwrites.

**If a second rep touches a company that is already attributed, the touch is
recorded, never refused** (`SalesAttributionTouch`). A contractor's ability to
sign up must never depend on FieldQuo's commission bookkeeping. It also means
that if a split policy is ever adopted, the evidence exists.

### If you leave, you keep earning

`departedRepStillEarns()` returns `true`, and this is a deliberate decision, not
an oversight. The reasoning, from the function's own comment:

The $125 is **one payment for one acquisition, split into three stages**. The
stages track the customer proving out; they are not three separate pieces of
work, and the third is not a retainer for still being employed. So the milestone
measures the **company's** retention, not the rep's employment, and `endedAt` is
deliberately not consulted.

The opposite rule is worse in both directions: it would let FieldQuo keep a
third of what it owes by timing a departure, and it would give a rep a reason to
stay employed rather than to sell.

`active: false` still stops a departed rep signing in and being attributed
anything **new**. The payout cron deliberately does not filter on `active`
either — a rep who left last Wednesday still earned what they earned before
Wednesday.

---

## Part 2 — Compensation

### The three milestones

`MILESTONE_ORDER` in `lib/sales/commission.js`. Defaults from
`model SalesCommissionPlan`:

| # | Key | Label on screen | Default | Decided by |
|---|---|---|---|---|
| 1 | `activation` | Activated | **$20.00** (`activationCents: 2000`) | `qualifiesForActivation()` |
| 2 | `first_payment` | First payment | **$40.00** (`firstPaymentCents: 4000`) | `qualifiesForFirstPayment()` |
| 3 | `retention` | Still paying | **$65.00** (`retentionCents: 6500`) | `qualifiesForRetention()` |
| | | **Total per acquisition** | **$125.00** | |

The amounts live on a **row**, not in a constant, so the numbers can change for
new reps without rewriting what existing ones were promised. An entry records
the amount it was written with; nothing looks the figure up again at payout.

`retentionDays` defaults to `60` and is on the plan, not a constant, because 60
is a policy. **A rep hired under different terms keeps the terms they were
hired under.**

### Milestone 1 — Activated · $20

```js
export function qualifiesForActivation(company) {
  return Boolean(company?.stripeChargesEnabled);
}
```

That is the whole rule. One column.

**Not "onboarding complete", and the reason matters.** `lib/onboarding.js`'s
team step is `seatsUsed > 1`, and `complete` requires every step — so before
`Company.worksAloneAt` existed, a one-person shop could *never* be complete. A
van-run solo operator is a core FieldQuo customer, so that gate would have paid
nothing on an entire class of legitimate sale.

**What the signal is worth, and why it is safe to pay this early:** Stripe has
verified a government ID, attached a real bank account and screened the account
before enabling charges. That is the fraud control. Twenty throwaway email
addresses cannot produce twenty verified identities.

Fires from `app/api/stripe/webhook/route.js` on `account.updated`, reading the
column *after* it is written so the milestone and the column cannot disagree.
The timestamp is Stripe's own `event.created`, never `new Date()`, so a replay
months later cannot move when it happened.

> **The referral programme pays on first payment instead.** The two programmes
> have different fraud postures **on purpose** — do not "harmonise" them, and do
> not explain one using the other's rules.

### Milestone 2 — First payment · $40

```js
export function qualifiesForFirstPayment(invoice) {
  if (!invoice) return false;
  if (invoice.billing_reason !== "subscription_create") return false;
  const paid = Number(invoice.amount_paid);
  return Number.isFinite(paid) && paid > 0;
}
```

Both conditions carry weight:

- **`billing_reason === "subscription_create"`.** The trap is
  `checkout.session.completed`, which fires **at trial start with nothing
  collected**, creates the Subscription row, and flips `onboardingStatus` to
  active. It is the event that looks right and is wrong.
- **`amount_paid > 0`.** The first month is free (`TRIAL_PRICE = 0`) and the
  referral programme grants further free months on top. Without this a $0
  invoice would pay a full commission on nothing collected.

Executed against every near-miss:

| Invoice | Pays? |
|---|---|
| `{ billing_reason: "subscription_create", amount_paid: 9900 }` | **yes** |
| `{ billing_reason: "subscription_create", amount_paid: 0 }` | no — free month |
| `{ billing_reason: "subscription_cycle", amount_paid: 9900 }` | no — month two |
| `{ billing_reason: "manual", amount_paid: 9900 }` | no |
| `{ billing_reason: "subscription_create" }` (no amount) | no |

### Milestone 3 — Still paying · $65

Anchored on **subscription start, trial included** — `Subscription.createdAt`,
the row written at `checkout.session.completed`.

**This was built wrong once and the fix is worth understanding.** Anchoring on
the first *payment* pays roughly a trial-length late: the first month is free,
so a payment lands near day 30, and counting sixty days from there means paying
at **day 91** for a milestone defined at day 60 — 31 days late, measured in the
worked example below.

A first payment is still **required**, but as a condition rather than as the
clock: a company sixty days in on a one-month trial has necessarily been
charged, so its absence means something went wrong.

Every refusal, executed (`subscriptionStartedAt` 2026-03-02, evaluated at day
60):

| Subscription state | Verdict |
|---|---|
| active, paid, clean | `{ qualifies: true, reason: "ok" }` |
| evaluated at day 59 | `{ qualifies: false, reason: "too_early" }` |
| `canceledAt` set | `{ qualifies: false, reason: "canceled" }` |
| `status: "past_due"` | `{ qualifies: false, reason: "status_past_due" }` |
| `status: "trialing"` | `{ qualifies: false, reason: "status_trialing" }` |
| `refundedAmountCents > 0` | `{ qualifies: false, reason: "refunded" }` |
| `disputeStatus: "lost"` | `{ qualifies: false, reason: "chargeback" }` |
| `disputeStatus: "warning_needs_response"` | `{ qualifies: false, reason: "dispute_open", holdUntilResolved: true }` |
| no first payment recorded | `{ qualifies: false, reason: "no_first_payment" }` |
| no subscription start | `{ qualifies: false, reason: "no_subscription_start" }` |

**`past_due` and `trialing` are explicitly not "still paying".** `past_due` is
what a failed charge sets, and paying a retention reward to somebody whose card
is currently declining is the opposite of what this milestone measures.

**An open dispute is held, not denied.** It may be won. The nightly sweep asks
again tomorrow, and the honest answer today is "not yet" rather than "no".

**Annual subscribers qualify.** They have made no *second* payment at day 60,
so a naive "have they paid again" test would deny every annual sale. The
condition is "still a paying customer", which an annual subscriber satisfies.
Their refund exposure is twelve times larger — that is a commercial risk to
price, not a branch to write.

Swept nightly at **09:20 UTC** by `/api/cron/sales-retention`. Nothing marks a
company "due"; the sweep re-derives from the ledger every night, so a run that
dies halfway simply resumes tomorrow.

---

## Part 3 — Worked examples

Every figure below is output from executing `lib/sales/commission.js` and
`lib/sales/payouts.js` against the schema-default plan
(`activationCents: 2000`, `firstPaymentCents: 4000`, `retentionCents: 6500`,
`retentionDays: 60`).

### Example A — one clean sale, month by month

A painter signs up through your link on **2 March 2026** and stays.

| When | Event | Function | Verdict | Earns |
|---|---|---|---|---|
| Day 0 · 2 Mar | Subscription created — trial starts, nothing charged | — | — | — |
| Day 4 · 6 Mar | Stripe Connect onboarding finishes, `charges_enabled = true` | `qualifiesForActivation({stripeChargesEnabled: true})` | `true` | **$20.00** |
| Day 31 · 2 Apr | First real invoice, `$99.00` | `qualifiesForFirstPayment({billing_reason:"subscription_create", amount_paid:9900})` | `true` | **$40.00** |
| Day 59 · 30 Apr | Nightly sweep runs | `qualifiesForRetention(... now: day59)` | `{qualifies:false, reason:"too_early"}` | — |
| Day 60 · 1 May | Nightly sweep runs | `qualifiesForRetention(... now: day60)` | `{qualifies:true, reason:"ok"}` | **$65.00** |

`balanceCents()` over those three entries: **$125.00**.

> Had milestone 3 been anchored on the first payment, it would have paid on
> **1 June 2026 — day 91, thirty-one days late.** That is the bug that was found
> and fixed; the anchor is subscription start.

### Example B — the sale that stalls at activation

Same painter, but Stripe Connect is finished and the contractor cancels during
the free trial.

- Day 4: activation fires — **$20.00**.
- Day 31: no invoice with `amount_paid > 0` ever arrives. Milestone 2 never
  fires, so **no first-payment row exists**.
- The retention sweep reads first-payment entries. With none, this company is
  never considered. Milestone 3 never fires.

**Total: $20.00.** This is the common shape of a lost deal, and it is why
activation-count alone is a misleading number to be judged on.

### Example C — the chargeback

Same as Example A through day 31 ($60.00 earned). On 10 May the contractor
disputes the first charge and loses it.

- A reversal is written as a **new negative row**, never an edit:
  `commission-reversal:<companyId>:first_payment`, amount `-4000`.
- The original keeps its `earned` status and its amount, because it remains
  true that it was earned. The pair is the history.
- `balanceCents()` over the four rows: **$85.00**.
- Milestone 3 would separately have refused with `reason: "chargeback"`.

The two idempotency keys are deliberately in separate namespaces so an earning
and its undo can both exist:

    commission:cmp_123:first_payment
    commission-reversal:cmp_123:first_payment

### Example D — a payout week

`/api/cron/sales-payouts` runs **Mondays at 10:07 UTC** and closes the week
**before** the one it runs in. Weeks are Monday-to-Monday, **UTC**, half-open.

Run at Wednesday 2026-04-08T10:07:00Z:

    weekBounds(now)          [ 2026-04-06T00:00:00Z , 2026-04-13T00:00:00Z )
    previousWeekBounds(now)  [ 2026-03-30T00:00:00Z , 2026-04-06T00:00:00Z )   <- closes this one

Five ledger entries around the boundary, through `entriesForWindow()`:

| Entry | `occurredAt` | Amount | In the batch? | Why |
|---|---|---|---|---|
| e1 | exactly `2026-03-30T00:00:00Z` (start) | $20.00 | **yes** | window is `>= start` |
| e2 | 2026-04-01 | $40.00 | **yes** | inside |
| e3 | exactly `2026-04-06T00:00:00Z` (end) | $65.00 | **no** | half-open — belongs to **next** week |
| e4 | 2026-03-30, already in `batch_old` | $20.00 | **no** | already batched |
| e5 | 2026-04-03, a reversal | −$40.00 | **yes** | reversals ride the same window |

`batchTotalCents()` = **$20.00** ( $20 + $40 − $40 ).

e3 is the one that matters. **Half-open `[start, end)` is what stops the same
entry landing in two batches and being paid twice.**

`splitPayable()` over all five: payable **$85.00**, already batched **$20.00**.

**Nothing is paid automatically.** A batch closes to `ready`, is exported, and
a person marks it `paid`. Moving money to a rep — payroll, withholding, a
cross-border transfer — is a decision with its own compliance surface that
nobody has made.

**What is paid is re-summed from the rows at payment time, never
`totalCentsAtClose`.** If a reversal lands after the close, the payable figure
is smaller, and `payableTotalFor()` reports `driftedFromClose: true` so a human
sees the number moved rather than discovering it by arithmetic.

**A week whose reversals outweigh its earnings nets negative, and the batch is
still created.** The debt is real and carries into what is paid next; hiding it
would make a rep's statement stop reconciling.

**A rep with nothing owed gets no batch at all** — an empty batch reads as "we
paid you nothing this week" and is indistinguishable from a bug to somebody
hunting a missing payment.

### Example E — a realistic month

Ten companies sign up through your link. Seven finish Stripe Connect, five
reach a first real payment, four are still paying at day 60.

    7 × $20.00  = $140.00   activation
    5 × $40.00  = $200.00   first payment
    4 × $65.00  = $260.00   retention
    ─────────────────────
                  $600.00

For contrast, ten signups that all completed all three stages would be
**$1,250.00**. The gap between $600 and $1,250 is the entire argument for
qualifying hard rather than signing up anyone who will click.

**Note the lag.** The retention money from a March cohort lands in May. A rep's
first two months look much worse than their steady state, and that is arithmetic,
not performance.

---

## Part 4 — Things that will surprise a new rep

Each of these is a place where the product's real behaviour differs from what a
reasonable person would assume.

1. **A rep with no commission plan earns nothing at all — silently.**
   `earnMilestone()` returns `null` when `commissionPlan` is missing, because
   paying an invented figure is worse than paying late. Every company that rep
   brought in is then **invisible to the ledger-sourced funnel** on
   `/platform/sales/performance`, which carries the caveat with a count of
   blind companies. *Check your plan is set on day one.*

2. **Your own commission balance is not on any screen you can reach.** As of
   the last status update, the rep-facing dashboard is unbuilt: `/api/sales/me`
   returns your link and your counts, and nothing renders a scoreboard from
   them. The superadmin console has the numbers; you do not.

3. **The schema comment on `retentionDays` is wrong.** It reads *"Days after the
   first successful payment before the retention milestone can be earned."* The
   code anchors on **subscription start**, not first payment — that is precisely
   the bug `qualifiesForRetention()`'s comment records having fixed. Trust the
   function.

4. **Activation is a fact; the other two are ledger rows.** The funnel reads
   activation off `Company.stripeChargesEnabled` directly — the same predicate
   the milestone uses — so it is right even for a rep with no plan. The other
   two stages are not.

5. **Cost per acquisition is deliberately not tracked.** Nothing in the product
   holds what a rep costs (a commission plan is per-sale, not salary), so the
   dashboard prints `NOT_TRACKED` with the missing input named rather than a
   zero. Same for calls and talk time (there is no human calling path — Twilio
   Voice does not exist in this repo), time to close, and pipeline value.

6. **No percentage is shown below ten outcomes.** `RATE_FLOOR` from
   `lib/analytics/kpis.js`. Below it the screen prints "3 of 4" and how many
   more are needed, rather than "75%".

7. **Ranking is by signups this week**, not commission (it lags sixty days and
   answers a finance question), not lifetime totals (a rep hired in March would
   outrank everyone forever), not conversion rate (most reps sit under the
   floor).
