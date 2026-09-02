# Research: signals for the three sales-commission milestones

**Status: research only. No product code was changed by this pass.** This
document exists to tell a future implementation exactly which existing
signals it can lean on, which it cannot, and where a commission engine could
pay wrong. It does not propose a schema or an RBAC model — that is
deliberately out of scope, per the brief.

I did not have Stripe test-mode access in this environment (same constraint
`docs/health/06-payments-integrations.md` notes). Everything below is "the
code, read carefully, says it will do X" — proven by reading real, currently
wired-up handlers, not by firing a live webhook. Where that matters I say so.

One correction to make up front: `docs/health/06-payments-integrations.md`
(the audit this brief points at) is **stale on refunds/disputes**. It says
"no webhook handling at all for `charge.refunded` or `charge.dispute.created`
on either endpoint." That was true when the audit ran; `docs/MONEY-FIXES.md`
§1 describes the fix, and `lib/stripe/settleChargeEvent.js` +
`lib/invoices/recordStripeRefund.js` + `lib/invoices/recordStripeDispute.js`
now exist and are wired into both webhook routes
(`app/api/stripe/webhook/route.js:134-140`,
`app/api/platform/billing/webhook/route.js:80-103`). The scope of that
handling matters a lot for milestone 3 — see §5 below, because it covers
**Connect** charges (a client's invoice payment), not **Billing** charges
(the contractor's own subscription payment).

---

## 1. Milestone 1 — is "capable of receiving payments" detectable today?

**Yes, cleanly, from a stored flag plus a real webhook — but "completed
business onboarding" is a separate, computed thing with no stored moment.**

**Connect onboarding finished — real signal, already wired.**
`Company.stripeChargesEnabled` (`prisma/schema.prisma:990`) is exactly the
Stripe-recommended readiness bit, and it is kept in sync by a live webhook,
not just set once at connect time:

```
app/api/stripe/webhook/route.js:64-74
case "account.updated": {
  const account = event.data.object;
  await db.company.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      stripeOnboarded: account.details_submitted,
      stripeChargesEnabled: account.charges_enabled,
    },
  });
  break;
}
```

So the Stripe event is `account.updated`, it fires on the Connect endpoint
(`STRIPE_CONNECT_WEBHOOK_SECRET`), and it writes two columns:
`stripeOnboarded` (`details_submitted`) and `stripeChargesEnabled`
(`charges_enabled`). **`stripeChargesEnabled` is the one that means "can
actually receive payments"** — `details_submitted` only means the Express
onboarding form was filled in, which Stripe can still be reviewing.
`lib/onboarding.js:94-98` already treats `stripeChargesEnabled` this way (the
"Connect Stripe to accept client payments" checklist step is `done: !!company.stripeChargesEnabled`), and five other call sites gate the actual pay
surfaces on it (listed in the health audit, confirmed still true by grep):
`app/api/invoices/[id]/checkout-link/route.js`,
`app/api/invoices/[id]/request-payment/route.js`,
`app/api/plan/[token]/route.js`, `app/api/service-plans/[id]/authorise/route.js`,
`app/api/booking/[companySlug]/route.js`.

There is even a **precedent for using this exact flag as a payout gate**:
`grantReferrerCredit()` in `lib/referrals/index.js:281-301` already refuses to
grant the referrer's credit unless
`company.onboardingStatus === "active" && company.stripeChargesEnabled` — i.e.
it will not reward a referral until the referred company is both a paying
subscriber (`onboardingStatus`) AND can actually take money
(`stripeChargesEnabled`). A commission engine for milestone 1 should reuse the
same predicate, not invent a third one that could quietly disagree with it.

**Only inferred from the stored flag, not from a live poll.** There is no
route or cron that calls `stripe.accounts.retrieve()` to double-check an
Express account's live state — `account.updated` is the only path that writes
these columns. If that webhook is ever missed (wrong signing secret, endpoint
disabled — both documented failure modes in the health audit, §"Signature
verification"), `stripeChargesEnabled` goes stale and a commission keyed on it
would simply never fire, not fire wrongly. There is no reconciliation cron for
Connect account status the way `booking-fees` (hourly) reconciles bookings.

**"Completed business onboarding" — no single flag; a live-computed
checklist, not an event.** `lib/onboarding.js`'s `getOnboardingStatus(companyId)`
returns `{ steps, percent, complete }`, where `complete: doneCount === steps.length`
(`lib/onboarding.js:177-183`). It is **recomputed on every read** — logo,
business address/phone, at least one enabled service, at least one priced
service, `stripeChargesEnabled` (payments — the same flag above), inviting a
team member, and (where applicable) tax registration. There is **no
`Company.onboardingCompletedAt` column and no event fired the moment
`complete` flips true** — the only place this is read is
`app/api/onboarding-status/route.js`, on demand, for the checklist UI.

**What this means for milestone 1 specifically:** the "can actually receive
payments" half is a real, already-webhook-driven signal
(`stripeChargesEnabled`, refreshed by `account.updated`). The "completed
business onboarding" half is not a discrete signal today — it's a live
predicate a commission engine would have to **evaluate itself** (call the same
`getOnboardingStatus()` logic, or a narrower version of it) on some trigger,
because nothing currently notices or timestamps the moment it becomes true.
Whatever triggers that evaluation (a webhook-driven recheck, a nightly sweep)
would need to be invented — this is a case where "say so plainly" applies:
there is no field to grep for that already means this, only a function that
computes it fresh each time.

---

## 2. Milestone 2 — which exact Stripe Billing event is the first successful subscription payment?

**`invoice.payment_succeeded`, filtered to `billing_reason === "subscription_create"`.**
This is not a guess — it's the literal mechanism the referral programme
already uses for the identical reason the brief describes, and its own
comment names it explicitly:

```
lib/platform/stripeBilling.js:528-535
// The referrer's three months are paid HERE, not at the referred
// company's signup. This is the first event that proves real money
// changed hands — granting on signup would make the programme a fraud
// target, since twenty throwaway addresses would earn five free years.
//
// `billing_reason` distinguishes the first invoice from every monthly
// renewal after it.
```

```
lib/platform/stripeBilling.js:561-564
if (
  obj.billing_reason === "subscription_create" ||
  obj.billing_reason === "subscription_cycle"
) {
```

`subscription_create` is the invoice for the subscription's first billing
cycle; `subscription_cycle` is every renewal after. Milestone 2 wants only
the first, so a commission trigger should match `billing_reason ===
"subscription_create"` specifically (not `subscription_cycle`, which the
referral code intentionally also matches for a different reason — recovering
a paying company that becomes a referrer later, `applyPendingReferralCredits`,
line 586).

**Why `checkout.session.completed` is the wrong event, concretely.** The
first month is free (`TRIAL_PRICE = 0` per `lib/pricing.js`, trial mechanics
in `lib/platform/stripeBilling.js:118-213`). `createTrialCheckoutSession`
opens the session with `subscription_data.trial_period_days` set
(`lib/platform/stripeBilling.js:193-203`) — Stripe creates the Subscription in
`trialing` status and `checkout.session.completed` fires the instant the
customer submits a card, **before any money moves**. That event is what
creates the `Subscription` row
(`upsertSubscriptionFromCheckoutSession`, `lib/platform/stripeBilling.js:400-459`)
and sets `Company.onboardingStatus = "active"` — i.e. it is exactly the event
that makes a company look "active" in this codebase, while genuinely having
paid nothing yet. **If a commission engine wired milestone 2 to
`checkout.session.completed` (or to `onboardingStatus === "active"`, or to
the Subscription row's mere existence), it would pay a $40 commission for a
trial signup that may never convert.** The subsequent real charge — trial
end, card actually billed — is what fires `invoice.payment_succeeded` with
`billing_reason: "subscription_create"`.

One more trap worth naming: **the "First Month" one-time line item is not it
either.** When `pricing.trialTotal > 0` (a paid first month, currently unused
because the first month is free — `lib/platform/stripeBilling.js:164-176`),
that's a one-time Checkout line charged *at checkout*, separate from the
recurring subscription price. Even in that configuration, `invoice.payment_succeeded`
with `billing_reason: "subscription_create"` is still the first *subscription*
invoice being paid — the thing milestone 2 is actually about — and remains
the correct trigger regardless of whether trials are free or paid in the
future.

**What would go wrong wiring the wrong event, ranked by how bad:**
1. `checkout.session.completed` → pays on a $0-collected trial start, before
   any card is actually charged. A contractor who never survives the trial
   still earns the sales rep $40.
2. `customer.subscription.created` / `customer.subscription.updated` → fires
   on *every* subscription state change (also used for `past_due`/`trialing`
   transitions, `lib/platform/stripeBilling.js:474-526`) — no reliable "this
   is the first real charge" signal, and would fire repeatedly.
3. `billing_reason: "subscription_cycle"` (a renewal, not the first payment)
   included by mistake → pays milestone 2 again every renewal month.

---

## 3. Idempotency — what pattern already exists, and what to reuse

Three concrete patterns are already in production, all documented in
`docs/health/06-payments-integrations.md` ("Webhook idempotency") and visible
directly in the schema:

- **Unique natural key + `P2002` catch** — `Payment.stripePaymentIntentId
  @unique` (`prisma/schema.prisma:2408`). `lib/invoices/recordStripePayment.js`
  reads-then-creates against this key; a race is caught as a unique-violation
  and treated as success, not an error.
- **Unique `ref` string on a ledger row** — `VoiceCreditEntry` unique on
  `ref` (referenced in the health audit at `lib/voice/credits.js:715-729`) —
  the create is attempted, a `P2002` collision returns the row that already
  won.
- **Claim-before-send via `@@unique`** — `MarketingCampaignDelivery`
  (`prisma/schema.prisma:4115-4125`) is `@@unique([campaignId, subscriberId])`;
  the send loop creates the delivery row as the claim and the unique index
  is the only thing stopping two concurrent runs from emailing the same
  subscriber twice (comment at `prisma/schema.prisma:4218`: "skips whoever
  already has a MarketingCampaignDelivery row").
- **Referral credit's own version of exactly this problem** —
  `ReferralCredit` unique on `companyId_role_counterpartyCompanyId`
  (`lib/referrals/index.js:307-316`): "one credit per (referrer, referred)."
  This is the closest existing analogue to a sales commission, because it is
  also a **reward paid off a Stripe Billing event**, gated the same way
  milestone 2 is gated (`billing_reason`).

**Recommendation for commissions:** a unique constraint on
`(companyId, milestone)` (e.g. `SalesCommission` unique on
`companyId_milestone`, mirroring `ReferralCredit`'s
`companyId_role_counterpartyCompanyId` shape) is the direct analogue. The
create-or-P2002 idiom is the same one every money-writing table in this
codebase already uses — no `StripeEvent` ledger table exists anywhere, by
design (health audit: "a reasonable design... when you have a natural key to
hang idempotency on").

**The exact duplicate-delivery scenario this defeats:** Stripe redelivers
`invoice.payment_succeeded` on a timeout, a 5xx, or a dashboard "resend" —
and, separately, **both webhook routes can legitimately receive the identical
event** for a destination-charge/platform-account object, per
`lib/stripe/settleCheckoutSession.js`'s header (the whole reason
`settleCheckoutSession`/`settleChargeEvent` are shared dispatchers called from
*both* `app/api/stripe/webhook/route.js` and
`app/api/platform/billing/webhook/route.js`). Concretely: Stripe delivers
`invoice.payment_succeeded` to the Billing endpoint once, and — if the
Stripe dashboard endpoint config for the *other* registered endpoint is ever
misrouted the way the booking-fee incident describes — it is not inconceivable
for the same logical event to be processed twice from two different code
paths. Without `(companyId, milestone)` uniqueness, two near-simultaneous
handler runs would both pass a `findFirst`-then-`create` check before either
commit, and the commission would be paid twice. With it, the second `create`
hits `P2002` and is a no-op — exactly the shape `grantReferrerCredit` already
defends against for the referral reward on the same event.

---

## 4. Out-of-order delivery — `invoice.paid` before the subscription row exists

This is a **documented, already-observed bug class in this exact codebase**,
not a hypothetical. `docs/health/06-payments-integrations.md` (table, third
row) names it directly:

> If `invoice.payment_succeeded` (the referral-credit trigger) arrives before
> `checkout.session.completed` has created the Subscription row, the lookup
> returns null and the referral credit is silently skipped — no retry, no
> error logged.

The code:

```
lib/platform/stripeBilling.js:565-569
const subscription = await db.subscription.findFirst({
  where: { stripeCustomerId: obj.customer },
  select: { companyId: true },
});
if (subscription?.companyId) {
  const granted = await grantReferrerCredit({ ... });
```

`findFirst` on a miss returns `null`; `if (subscription?.companyId)` is a
silent skip with **no retry and no error logged**. The health audit is
explicit that this is a real, live gap (not just theoretical): "The cost is
the referral-credit gap noted above, not a money-safety bug — nothing is
double-charged or double-credited, something is just skipped once and then
never retried, because the code has no reason to know it needs to."

**How a commission engine avoids the identical bug for milestone 2:** do not
rely solely on the live webhook's synchronous lookup succeeding. Two options,
not mutually exclusive:

1. **Log the miss, don't just skip it.** The referral code's actual defect
   isn't the race itself (races are normal with Stripe's no-ordering-guarantee
   delivery) — it's that a miss produces *no signal at all*. A commission
   handler should call `recordError()` (the pattern every other webhook
   handler in this codebase already uses — see
   `app/api/platform/billing/webhook/route.js:58-69,95-101,146-154`) when the
   lookup misses, so it surfaces in `/platform/errors` instead of vanishing.
2. **Recheck, not just react.** Because Stripe's ordering isn't guaranteed,
   a commission that depends on "the Subscription row already exists" should
   also be re-derivable from a later, idempotent sweep — the same shape a
   retention cron (§5, §6) would already need to run. A milestone that can
   *only* fire off a single webhook's synchronous state has exactly this
   failure mode; a milestone that a nightly sweep can also discover and pay
   (because the sweep re-evaluates "has this company had a first successful
   payment yet, and have I paid the commission for it" from durable state,
   not from webhook order) is self-healing the way `booking-fees`' hourly
   reconciliation already is for bookings.

Concretely, `invoice.payment_succeeded` carries `obj.customer` and (usually)
`obj.subscription` — the payment itself doesn't strictly need the
`Subscription` row to exist to know a real charge cleared for that Stripe
customer. A commission handler could resolve `companyId` the same
multi-fallback way `recoverCompanyId()` already does for checkout sessions
(`lib/platform/stripeBilling.js:352-375`: `client_reference_id` →
`stripeCustomerId` match → ...) rather than a single `findFirst` that gives up
silently.

---

## 5. Milestone 3 — "still paying at 60 days," and reversal on a later refund

**No existing mechanism computes this today — it would need to be new.**
There is no "N days since first payment, still active" check anywhere in the
codebase; the closest analogues are the 7-day grace clock
(`pastDueSince`, §6) and the 30-day post-cancellation read-only window
(`canceledAt`), both of which are *shorter, differently-shaped* windows for
*different* purposes (locking access, not paying a reward).

**Cron sweep vs. per-company scheduled check:** every existing time-based
money/notification decision in this codebase is a **nightly cron that sweeps
all eligible rows**, not a per-company scheduled job set up individually —
`grace-warning` (`0 9 * * *`, sweeps every `status: "past_due"` subscription),
`renewal-reminders` (`0 9 * * *`, sweeps by `currentPeriodEnd` proximity, per
`docs/health/06-payments-integrations.md`'s reconciliation section). A 60-day
retention milestone should follow the identical shape: a nightly cron querying
`Subscription` for rows where the first real payment was ~60 days ago and the
milestone hasn't been paid, not a per-company timer. This matches the "18
existing crons, all sweep-shaped" pattern in `vercel.json` (§6).

**What it would have to examine, based on what's actually recorded:**
- **First-payment timestamp.** There is no `Subscription.firstPaidAt` column.
  The nearest proxy is the `invoice.payment_succeeded` event with
  `billing_reason: "subscription_create"` from milestone 2 — if that event is
  what stamps a commission-tracking row (§3's recommended `SalesCommission`
  table), that row's `createdAt` (or an explicit `paidAt`) is the 60-day
  anchor. Nothing else in `Subscription` currently marks "the date the first
  real charge cleared" — `createdAt` on `Subscription` is when the *row* was
  created (at `checkout.session.completed`, i.e. trial start, not payment).
- **Subscription status.** `Subscription.status` — must still be `active` (or
  `trialing`/`past_due` are explicitly *not* "still paying"; per
  `lib/platform/stripeBilling.js:474-526`, `past_due`/`unpaid` trigger
  `markPastDue`).
- **Cancellation.** `Subscription.canceledAt` must be null — set from
  `customer.subscription.deleted`
  (`lib/platform/stripeBilling.js:591-627`), stamped from **Stripe's own**
  `obj.canceled_at`, not `new Date()` (deliberately, so a replay can't move
  it).
- **Refund / chargeback.** Here is the real gap: **`settleChargeEvent.js`
  (and `recordStripeRefund.js`/`recordStripeDispute.js` underneath it) is
  scoped to `Payment` rows only, and `Payment` rows are created by
  `recordStripePayment`/`recordStripeRefund` for **Connect-side invoice
  payments only** (a client paying the contractor). `recordStripeRefund.js`'s
  own header is explicit about this scope:

  ```
  lib/invoices/recordStripeRefund.js:18-24
  // Only refunds that land on an Invoice Payment are handled here. ...
  // A charge with no matching Payment (a subscription invoice, an AI/voice
  // top-up) is simply not ours, the same "not one of ours" contract
  // settleCheckoutSession.js uses for checkout sessions.
  ```

  **A refund or chargeback on the contractor's own Stripe *Billing* charge —
  the subscription payment milestone 2 is about — is not tracked anywhere in
  this codebase today.** No `Payment` row is ever created for a subscription
  invoice; only `Invoice`/`Payment` (Connect side) have refund/dispute
  columns. If a contractor disputes their own FieldQuo subscription charge
  with their card issuer, or Stripe refunds it, **nothing here currently
  records that fact** — `Subscription` has no `refundedAt`/`disputeStatus`
  columns, and neither `settleChargeEvent.js` nor anything else listens for a
  `charge.refunded`/`charge.dispute.*` event tied to a *subscription's*
  underlying charge. This is a real, concrete gap milestone 3 would surface
  immediately: "no refund, no chargeback" on the qualifying payment cannot be
  verified today without new code to track it (most naturally: extend the
  same `charge.refunded`/`charge.dispute.*` handlers to also check for a
  matching Subscription-side charge, the same way `recordStripeRefund`
  currently checks for a matching `Payment`).

**How a commission already paid gets reversed — the pattern to copy.** The
existing refund/dispute design (Connect side) is instructive even though its
scope doesn't cover Billing charges: `computeInvoiceState.js` is a **pure
function** that re-derives `Invoice.status`/`amountPaid`/`amountRefunded` from
scratch on every event, and the three-way `InvoiceStatus` split
(`refunded` / `partially_refunded` / `disputed`) exists specifically because
"the brief was explicit that 'refunded' and 'disputed' are different facts...
Overloading `paid` would have made the status lie" (`docs/MONEY-FIXES.md`
§1). **The commission analogue is a state transition on the commission row,
not an edit to the amount paid** — a `SalesCommission.status` of `paid` →
`reversed` (or `clawed_back`), with a *new* transaction/ledger entry recording
the negative, exactly the way `Payment.refundedAmount` is written as Stripe's
own cumulative total (idempotent, replay-safe) rather than the original
`Payment.amount` row being mutated in place. Never edit the original paid
amount; add a reversing record, dated from Stripe's own event timestamp (the
same discipline `canceledAt` uses — stamped from `obj.canceled_at`, never
`new Date()`, so a replay months later can't move it).

---

## 6. What existing crons could this ride, and the `vercel.json` schedule

`vercel.json` currently lists **18** crons (confirmed by direct count):

```
large-quote-check        0 9 * * *
follow-ups                0 8 * * *
recurring-jobs             0 5 * * *
appointment-reminders      0 * * * *
monthly-digest            0 8 1 * *
review-requests             0 * * * *
voice-outbound            */15 * * * *
voice-rent                 0 7 * * *
service-plans               0 6 * * *
booking-fees                15 * * * *
voice-reconcile              35 * * * *
voice-resync                50 * * * *
voice-auto-topup            */15 * * * *
crew-line-rent               0 7 * * *
renewal-reminders            0 9 * * *
grace-warning                 0 9 * * *
payment-schedule              10 6 * * *
social-scheduled-publish      */5 * * * *
```

None of these is a natural place to *fold in* a retention sweep — they're
each scoped to a different domain (voice billing, booking fees, marketing).
The right move is a **new** cron, e.g. `app/api/cron/sales-commissions/route.js`
(or split into `.../milestone-1-check`, `.../milestone-3-retention` if the
implementation wants separate sweeps for the checklist-completion check
(§1) versus the 60-day retention check (§5) — they run on very different
cadences and query very different tables).

**What it must follow, based on `grace-warning`'s and `renewal-reminders`'
existing shape** (`app/api/cron/grace-warning/route.js` is the cleanest
template — read in full):

1. `const denied = requireCronSecret(request); if (denied) return denied;`
   at the top — every cron route does this
   (`lib/security/cronAuth.js` — `timingSafeEqual`, explicitly hardened
   against the "Bearer undefined" footgun described in its own header).
2. **Claim before acting, revert on failure** — `grace-warning`'s comment
   states the principle directly: "This is a time-limited notice... with a
   database column whose whole job is 'don't send this twice'... the claim is
   provisional — written before the send to stop a concurrent run colliding —
   and rolled back to null if the send didn't actually happen." A commission
   payout should claim (write a `pending`/`claimed` row via the unique
   `(companyId, milestone)` constraint from §3) *before* triggering whatever
   external effect a paid commission has (a payout, a notification to sales),
   and only finalize the claim on confirmed success — reverting it (deleting
   the pending row, or flipping it back) if the downstream action failed, the
   same way a failed email send un-claims `graceWarnedAt`.
3. **Batch + leftover-tomorrow, not a cursor** — `grace-warning`'s `BATCH = 500`
   comment: "Leftovers are picked up by tomorrow's run — the query is driven
   by `status`, not a cursor, so nothing is dropped." A retention sweep should
   query by a durable predicate (e.g. `SalesCommission` rows with
   `milestone: "retention_60d", status: "pending"` and the anchor date past
   due) rather than paginating with an offset that could skip rows if the set
   changes between runs.

---

## 7. The money-safety list, ranked by likelihood

1. **Pay milestone 2 on the wrong event (highest likelihood, highest
   plausibility of being the actual bug shipped).** `checkout.session.completed`
   fires at trial start with $0 collected — it is the *obvious*-looking event
   (it's what creates the `Subscription` row and flips `onboardingStatus` to
   `active`), and it is wrong. The correct event,
   `invoice.payment_succeeded` filtered to `billing_reason ===
   "subscription_create"`, is one field-check away from also silently
   matching `subscription_cycle` (every renewal) if the filter is dropped or
   mistyped — which would pay the $40 commission monthly forever instead of
   once. See §2.
2. **Fail to reverse on a subscription-side refund/chargeback (second most
   likely, because the infrastructure to even detect it doesn't exist yet).**
   `settleChargeEvent.js` only recognizes refunds/disputes tied to a `Payment`
   row, which only exists for Connect-side invoice payments — never for the
   contractor's own subscription charge. Unless this is explicitly built,
   milestone 3's "no refund, no chargeback" condition **cannot be checked at
   all**, and a commission would be paid (and never clawed back) on a
   subscription payment that was later fully refunded. See §5.
3. **Pay twice on duplicate webhook delivery.** Mitigated cheaply and
   completely by copying the `ReferralCredit`-style unique constraint (§3) —
   low likelihood *if built this way*, but the failure mode is silent and
   compounds (a resend, or dual-endpoint delivery per
   `settleCheckoutSession.js`'s documented topology, could otherwise double-
   pay every time it happens).
4. **Miss milestone 2 entirely on out-of-order delivery, with no visible
   error.** Directly modeled on the *already-observed* referral-credit gap
   (§4) — not a double-payment risk, but a silent-loss risk that would read to
   sales as "commission never fired" with no trail to debug from, unless the
   miss is logged via `recordError()` rather than silently `if (row)`-skipped
   the way the referral code currently does.
5. **Pay milestone 1 on `onboardingStatus === "active"` alone, without
   `stripeChargesEnabled`.** `onboardingStatus` flips to `"active"` at
   `checkout.session.completed` (trial start) — the same over-early signal as
   risk #1, but for milestone 1 instead of 2. `stripeChargesEnabled` is the
   flag that actually means "can take money," and it's a *different* Stripe
   integration (Connect, not Billing) entirely — conflating the two is
   exactly the trap the brief and `AGENTS.md` name explicitly. Lower
   likelihood than #1 only because the two milestones are less likely to be
   implemented by the same code path, but the same mistake — "the field that
   turns true earliest looks like the signal" — is what causes both.
6. **Pay milestone 1's "business onboarding" half on a stale/never-computed
   check.** Because `getOnboardingStatus().complete` has no stored moment
   (§1), an implementation that (reasonably) tries to cache "onboarding
   complete" as a boolean written once could drift from the live checklist —
   e.g. a company un-invites its only teammate after the flag was set, and
   the flag no longer reflects `complete` truthfully. Lower dollar risk than
   the above (harder to game deliberately) but the same "wrote it, never
   re-read it" failure class `AGENTS.md` names as the #1 recurring bug in
   this codebase.

---

## Files read for this research

- `lib/stripe.js` — Connect: destination charges, `transfer_data`
- `lib/platform/stripeBilling.js` — Billing: checkout builders, webhook sync,
  referral credit trigger, trial-end sync, portal session
- `app/api/stripe/webhook/route.js` — Connect endpoint (`account.updated`,
  `checkout.session.completed`, refund/dispute dispatch)
- `app/api/platform/billing/webhook/route.js` — Billing endpoint (subscription
  sync, AI bundle disambiguation, refund/dispute dispatch)
- `lib/stripe/settleCheckoutSession.js` — shared idempotent Checkout dispatcher
- `lib/stripe/settleChargeEvent.js` — shared refund/dispute dispatcher (Connect
  scope only)
- `lib/invoices/recordStripeRefund.js`, `lib/invoices/recordStripeDispute.js`
- `lib/invoices/computeInvoiceState.js` (referenced, not quoted in full)
- `lib/referrals/index.js` — referral programme, `grantReferrerCredit`
- `lib/onboarding.js`, `app/api/onboarding-status/route.js` — the live
  onboarding checklist
- `prisma/schema.prisma` — `Company` (Connect fields), `Subscription`,
  `Payment`, `Invoice`/`InvoiceStatus`, `MarketingCampaignDelivery`
- `docs/health/06-payments-integrations.md` — the payments audit this brief
  points at (noted where it is now stale)
- `docs/MONEY-FIXES.md` — the refund/dispute fix that postdates that audit
- `app/api/cron/grace-warning/route.js` — cron template (claim/revert,
  `requireCronSecret`, batch pattern)
- `lib/security/cronAuth.js` — `requireCronSecret`
- `vercel.json` — the 18 existing crons

## What I could not verify without Stripe test-mode access

- Whether `account.updated` genuinely fires with the timing/shape assumed
  here in the live Stripe dashboard configuration this deployment actually
  uses (per the health audit, this environment has no confirmation of which
  Stripe mode — test or live — is presently wired, nor confirmation the
  Connect webhook endpoint is registered to receive `account.updated` at
  all).
- Whether `invoice.payment_succeeded` can, in practice, arrive detectably
  "before" `checkout.session.completed" often enough to matter — the health
  audit flags this as worth asking Stripe support/docs about; I could not
  reproduce or rule it out here.
- Whether a duplicate `checkout.session.completed`/`invoice.payment_succeeded`
  delivery to *both* registered endpoints (the scenario §3 describes) is a
  real, currently-occurring pattern in this deployment or a theoretical one —
  it depends on how the two Stripe webhook endpoints are actually configured
  in the dashboard, which this environment cannot inspect.
