# Financing implementation — Dynamic invoice Checkout

23 September 2026. Normal invoice Checkout now uses server-selected Stripe
Payment Method Configurations and Dynamic Payment Methods. No database push,
Stripe configuration change, account-country change, historical payment
rewrite, or production deployment has been performed.

## Implemented independently of the unresolved decisions

- `lib/stripe/actualPaymentMethod.js`: read the selected method from the
  actual Charge, then an attached PaymentMethod. Never infer it from a
  permitted-method array. Preserve unknown future method names. Missing
  evidence and lookup failures return null; logs omit Stripe error payloads.
- `lib/stripe/paymentIntentFee.js`: use that reader instead of guessing from
  a single permitted method. Expand the attached PaymentMethod during lookup.
  The existing fee policy and adjustment behavior otherwise remain intact.
- `lib/stripe/settleCheckoutSession.js`: use actual evidence for pending,
  successful and failed invoice Checkout Sessions. Pass method evidence to
  payment recording even when the fee lookup returned null.
- `lib/invoices/recordStripePayment.js`: write the selected raw method to the
  existing nullable `feeRateLabel` independently of fee availability. No
  historical rows are backfilled.
- `lib/stripe/paymentCurrency.js` and `lib/stripe.js`: normal and dedicated
  bank-debit invoice Checkout now validate CAD/USD/GBP/EUR/AUD explicitly.
  An absent or unrecognized currency fails before creating a Session.
  Display formatting and unrelated Billing flows retain their existing behavior.
- `lib/stripe/invoicePaymentConfiguration.js`: selects the server-only
  financing-allowed or financing-off parent configuration and fails before
  Stripe when its environment variable is absent or malformed.
- `lib/stripe.js`: normal invoice Checkout omits `payment_method_types`, sends
  `payment_method_configuration`, and removes the legacy Affirm Checkout gate
  and fallback. The dedicated bank-debit, booking, service-plan, and voice
  flows retain their explicit method behavior.

The new method and currency checks run as part of `npm run check:processing-fee`.
Tests also exercise bank-debit evidence, failed-payment unknown methods, and
recording a future method when fee information is absent.

## Required decisions and release dependency

### International commercial policy

`lib/stripe/processingFee.js` defines the provisional card collection only for
CAD and USD: 3% plus 30 minor units, with the existing published floor and
0.1% card margin. There is no approved GBP/EUR/AUD rate. Recognizing those
currencies is not permission to copy rates into them. Their Checkout creation
therefore still fails explicitly with `No published processing rate`.

Required: approve each currency's provisional collection, final fee/margin
policy, and whether the existing published floor applies. Also clarify the
margin/floor for dynamically selected ordinary methods and financing methods
other than the legacy card/Affirm path. The existing implementation maps
Affirm to the card margin but gives other method names no card margin; that
inconsistency is not evidence of an approved provider-neutral price policy.

### Rollback baseline

The current repository implementation does not understand a durable adjustment
ledger or document currency snapshots. `settledFeeFor` can reverse a transfer
before recording the payment, compares raw balance-transaction fees without
checking their currency, and relies on a Stripe idempotency key rather than a
durable operation record. Reverting a new reconciler to that implementation
would restore those behaviors and bypass the new safeguards.

Stripe can prune idempotency keys after at least 24 hours; the legacy key is
not an indefinite duplicate-operation guarantee. See
[Stripe idempotency](https://docs.stripe.com/api/idempotent_requests).

The exact production/previous Vercel deployment-to-commit mapping must still
be checked before deploying this change.

Recommended sequence, requiring agreement before the broader switch:

1. A compatibility release adds and consumes currency snapshots, durable
   operation records, currency-safe reconciliation, and new payment-policy
   metadata **before** any dynamically configured Sessions are created.
2. Validate that release as the rollback baseline, including delayed and
   duplicate webhooks, refunds, pending fee evidence and uncertain Stripe
   operation outcomes.
3. A subsequent release enables Dynamic Payment Methods. Its immediately
   previous deployment then retains the settlement safeguards needed for
   Sessions created by the new release.

This change does not add a database schema dependency, so reverting the
deployment restores the previous Checkout builder without a database rollback.

## Work still required

The broader financing roadmap remains open beyond this narrow Checkout fix:

1. Additive invoice/payment currency snapshots and durable reconciliation /
   adjustment records; review the schema diff before any `prisma db push`.
   No schema change has been made yet.
2. Read and validate the two connected-account parent configurations, including
   effective child settings and test/live mode. No configuration IDs are
   accepted from clients. Fail explicitly on absent or invalid configuration.
3. Version the approved fee policy; separate invoice completion from durable
   fee reconciliation. Persist provisional/actual/margin/target/confirmed/
   outstanding amounts with currencies and evidence. Never guess FX.
5. Make adjustment operations durable across retries, concurrency, crashes and
   idempotency-key expiry. Coordinate with refunds/disputes. Preserve old
   Session settlement without performing an unsolicited historical Stripe sweep.
6. Readiness and translated UI distinguish preference, configuration,
   capability/requirements, explicit restrictions and unknown/stale evidence.
   Never promise a provider or customer approval. Keep external financing separate.
7. Snapshot and consistently read document/payment currencies; approve new
   currency fee policies. Do not infer historical currencies from today's company.
8. Complete the full requested test matrix and verify the two-release rollback
   sequence. Current passing legacy tests do not prove the new architecture.

## Future environment and Dashboard configuration

The implementation requires these server-only environment variables:

- `STRIPE_INVOICE_PMC_FINANCING_OFF`
- `STRIPE_INVOICE_PMC_FINANCING_ALLOWED`

Create configurations in test mode first, then separately in live mode. In the
FieldQuo platform Dashboard:

1. Select the intended test environment first. Open **Settings → Payment
   methods → For connected accounts** at
   <https://dashboard.stripe.com/settings/payment_methods/connected_accounts>.
2. Add parent configurations named `FieldQuo Invoice — Financing Off` and
   `FieldQuo Invoice — Financing Allowed`. Enable each configuration's Active
   status under its management menu.
3. Give both the approved ordinary payment methods. Exclude dedicated bank
   debits from both. In the Off configuration, block every financing/BNPL
   method, rather than merely switching its default off (a child can override
   a default). Audit this again when Stripe adds methods.
4. In Allowed, enable the supported financing methods that Stripe permits for
   FieldQuo's business model. Do not assume a displayed switch establishes a
   connected contractor's eligibility. Inspect TrueFinish's effective child
   configuration and capability requirements without changing its country.
5. Copy the **parent** IDs to the matching server variables for that
   environment. Use separately created live configurations and live IDs for
   production; never reuse test IDs there.

Stripe resolves the connected child's settings from the parent configuration.
Express accounts need platform-managed/API/embedded configuration where the
full Dashboard is unavailable. See
[Stripe's connected-account configuration guide](https://docs.stripe.com/connect/multiple-payment-method-configurations).

`payment_method_configuration` is documented for Checkout on the pinned
[`2025-01-27.acacia` API](https://docs.stripe.com/api/checkout/sessions/create?api-version=2025-01-27.acacia).
The normal invoice Checkout omits `payment_method_types` and does not add
`automatic_payment_methods` to its Session request.

## Live verification — only after implementation and test-mode verification

Do not claim a financing provider is available until this checklist succeeds in
the relevant LIVE account and transaction.

1. Record the approved compatibility deployment ID and confirm the live parent
   IDs, account mode and API version without exposing secrets.
2. Confirm TrueFinish's company-to-Express-account mapping, existing country,
   actual capabilities/requirements and effective child configuration. Record
   any explicit business restriction as Stripe reports it; do not relabel it
   as a FieldQuo preference or infer customer eligibility from it.
3. With the contractor's agreement, create a controlled new invoice in its
   documented currency. With financing off, inspect the new Session's selected
   configuration and verify no BNPL is offered.
4. Enable financing and create a fresh Session. Verify the allowed parent was
   selected and the contractor remains `on_behalf_of` and transfer destination.
   Verify the provisional application fee. Absence of a provider may be correct.
5. Inspect eligible methods for the real transaction/customer. Never fabricate
   country, address, industry or amount to bypass eligibility. A Canadian
   contractor cannot validate UK/Australian/European merchant availability.
6. Any real card/financing payment requires the customer's informed approval.
   Verify the Stripe Charge's actual method, exactly one gross Payment, the
   correct invoice balance, and separate fee-reconciliation status/evidence.
7. Verify effective behavior when fee evidence is pending; replay a verified
   event without collecting or reversing money twice. Review operation IDs and
   currency evidence, not just application logs.
8. With approval, test a partial and then remaining refund. Verify negative
   payment records, original gross history, invoice state and no duplicated
   fee adjustment. Confirm the dedicated bank-debit and external-provider link
   still behave separately.
9. Check an unpaid legacy Session can settle after release. Test rollback to
   the approved compatibility deployment with outstanding reconciliation work.
10. Use separate legitimately onboarded accounts to verify each other target
    country. TrueFinish alone cannot establish international live support.

No LIVE financing availability has been verified.

## Rollback of the partial changes currently implemented

No database or Stripe-side changes need undoing. If these limited changes are
deployed separately, revert that deployment to its predecessor. The only new
persisted value is an actual raw method name in an existing nullable string
column; older code already accepts raw method names and has a generic display
fallback. Leave payment records intact. This restores the predecessor's
method-guessing and currency-default behavior; it does not make those behaviors
safe. This statement does **not** establish rollback safety for the unbuilt
reconciliation/Dynamic Payment Methods release.

## Remaining Affirm references

The amount gate, explicit provider list, fallback retry, fee mapper/descriptions
and financing settings copy are still active legacy behavior. They are pending
replacement, not claimed as necessary historical compatibility. Historical
raw `affirm` method labels and display translations must continue to work.
External provider URL examples are a separate feature and must be preserved.
The selected-method reader contains no provider-specific branch.

## Verification results for these partial changes

- `npx prisma validate`: passed; no schema was pushed.
- `npm run check:processing-fee`: passed (31 method checks, 24 currency checks,
  249 existing/extended processing-fee assertions).
- `npm run check:money-flow`: 162/162 passed.
- `npm run check:stripe-destinations`: 87 passed, 0 failed.
- `npm run check:stripe-identity`: passed.
- `npm run check:service-plans`: 171/171 passed.
- `npm run check:financing`: 30 passed, 0 failed.
- `npm run check:financing-estimate`: 112 passed, 0 failed.
- `npm run check:invoice-family-ledger`: 46 assertions passed.
- `npm run check:app-currency`: failed on existing hard-coded currency symbols
  in `app.cost.hoursAtZero` and four `app.leads.reason.budget*` translations.
  This task did not edit the already-modified translation file.
- `npm run build`: passed. An initial run caught a missed removed-helper call,
  which was fixed; the next attempt could not fetch Google Fonts in the
  sandbox. The network-enabled retry completed successfully.
- `git diff --check`: passed.

The full new-architecture matrix (PMC selection, durable adjustment crash /
concurrency / retry handling, currency snapshots, readiness and rollout) has
not been implemented or claimed tested. Existing checks still exercise the
legacy Affirm Checkout branch; passing them does not mean that branch was
removed.

Suggested commit for these partial changes only:
`git commit -m "fix(stripe): record actual invoice payment methods and reject invalid currencies"`
Do not include unrelated pre-existing workspace changes in that commit.
