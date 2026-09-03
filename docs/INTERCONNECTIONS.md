# Interconnections — read this before adding a model or a number

Asserted by `scripts/check-interconnections.mjs`, in `check:all`. When a flow
changes, that check fails and this file gets corrected. **A map nobody verifies
is a map of what someone believed on the day they wrote it.**

## Why this exists

Three features shipped in one week where a number reached a screen and reached
no total. Each was written by someone who had read a comment saying it would.

| What | Where it went | What read it |
|---|---|---|
| `ChangeOrder.priceDelta` | a form, a list, a KPI | **no invoice, no margin** |
| Phone-punched `TimeEntry` | created with no `jobId` | **job costing filters on `jobId`** |
| A receipt aimed at `JobMaterial.actualCost` | a sourcing row | **costing never reads that table** |

All the same shape: **a plausible destination that nothing consumes.** A
document describing the intended flows would have caught none of them, because
it would have described the intention.

**So the rule is: before you write a number anywhere, find who reads it.**
Not who *should* — who does, today, in code you have opened.

---

## Money: what reaches a job's margin

```
                    ┌─ Expense (projectId = job)  ──┐
ACTUAL COST  ←──────┼─ TimeEntry (jobId)          ──┤──→ actualJobCost()
                    └─ AssetUseLog                ──┘

REVENUE      ←──────  Quote.total  +  approved ChangeOrder.priceDelta

MARGIN       =  revenue − actual cost
```

**`JobMaterial` is NOT in this.** It is the sourcing list — what to buy —
written only by `lib/jobs/sourcingList.js`. Its comment says "`actualCost` is
what the receipt said", which is true about intent and silent about
consequence. Prefilling it is useful; it moves no margin.

**A receipt therefore lands on `Expense`** — `receiptUrl`,
`receiptCapturedAt`, `receiptExtract` (verbatim, before any edit),
`vendorName`, `supplierId`. That is the row costing sums.

**A time entry must carry `jobId`** or the hours are invisible. The self-serve
clock omitted it, so every hour punched on a phone vanished from the job.

## Money: what reaches an invoice

An approved change order reaches a draft invoice **explicitly** — a person
presses a button, with a loud warning while agreed changes are unbilled.
Payment stages keep their agreed figures; the card *says* the stages do not
cover £X rather than silently re-basing a deposit the client already saw.

## Money: what earns a sales commission

```
$20  activation    ← Company.stripeChargesEnabled       (Connect KYC done)
$40  first payment ← invoice.payment_succeeded
                      billing_reason = subscription_create
                      AND amount_paid > 0                (the free month is $0)
$65  retention     ← 60 days from Subscription.createdAt (TRIAL INCLUDED)
                      still active, not cancelled, no refund, no chargeback
```

**Never gated on onboarding completeness** — a one-person shop can never
complete it, so that gate pays nothing on a whole class of real sale.

## Truth: who is on trial, and who never paid

```
Subscription row exists   → checkout completed
Subscription.status       → Stripe's own word; the trial authority
billingStartedAt          → first real money (null = still unpaid)
trialEndsAt               → when the trial was MEANT to end (never cleared)
onboardingStatus          → pending at creation, active at checkout,
                            churned only when a human clicks
```

**No subscription row = never completed checkout.** Not `onboardingStatus`
(flips at trial *start*), not `trialEndsAt` (stamped before checkout, present
on all ten abandoned signups).

## Boundaries that must not be crossed

| Rule | Enforced by |
|---|---|
| One file talks to the model vendor | `lib/ai/provider.js` |
| One helper answers "is this a demo" | `lib/demo/simulatedSpend.js` |
| A concurrency guard goes in the `where`, never an `if` above it | `lib/concurrency/staleWrite.js` |
| A recommendation may only cite a real capability | `ProspectOpportunity.capabilityCode` FK → `FieldQuoCapability` |
| A rep never writes their own attribution or ledger | `lib/sales/gate.js` |
| FieldQuo's own spend is not a tenant's | `PlatformAiUsage`, `PlatformVoiceCall` |

## Three-valued fields — `null` is not `false`

| Field | `null` means |
|---|---|
| `ProspectCapability.value` | we could not look — **not** "they don't have it" |
| `ClientEquipment.warrantyEndsAt` | unknown — **not** "out of warranty" |
| `Prospect.hasWebsite` | not checked — **not** "no website" |
| `providerCostCents` | the vendor gave no figure — **not** free |

Collapsing any of these produces a confident false statement to a customer.

## Before adding a model, check these first

- **A lead?** `SalesLead` (rep pipeline) vs `Prospect` (discovered, org-wide)
  vs `LeadRequest` (a tenant's inbound). Three, deliberately.
- **A vehicle?** `Asset` with `category: "vehicle"` already exists and carries
  depreciation. `VehicleDetail` extends it; it does not replace it.
- **Equipment?** `Asset` is the contractor's own. `ClientEquipment` is their
  customer's.
- **A document?** `lib/documents/` is PDF **rendering**. `JobDocument` is
  document **management**. Different things, confusingly named.
- **A ledger?** `VoiceCreditEntry`, `SalesCommissionEntry` and `StockMovement`
  are all append-only, summed not stored, reversals as negative rows. Follow
  that shape rather than inventing a fourth.
